// <== IMPORTS ==>
import mongoose from "mongoose";
import { Trash } from "../models/trash.model.js";
import { Account, DELETION_MODES } from "../models/account.model.js";

// <== HELPER FUNCTION TO RESOLVE EXPIRY DATE BASED ON RETENTION DAYS ==>
const resolveExpiresAt = (retentionDays) =>
  new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

/**
 * MOVE A DOCUMENT TO TRASH OR HARD-DELETE IT, DEPENDING ON THE ACCOUNT'S DELETION MODE PREFERENCE
 * CALLER IS RESPONSIBLE FOR ALL BUSINESS-RULE GUARDS (E.G. OUTSTANDING BALANCE CHECKS) BEFORE CALLING THIS
 * @param {object} params
 * @param {string} params.accountId - ACCOUNT ID OWNING THE DOCUMENT
 * @param {string} params.entityType - ONE OF TRASH_ENTITY_TYPES — MUST MATCH THE MONGOOSE MODEL NAME
 * @param {import("mongoose").Document} params.document - THE MONGOOSE DOCUMENT INSTANCE TO REMOVE
 * @param {string} params.performedBy - USER ID PERFORMING THE DELETION
 * @returns {Promise<{ trashed: boolean }>} - TRASHED TRUE IF TRASHED OTHERWISE FALSE IF HARD-DELETED INSTANTLY
 */
// <== REMOVE DOCUMENT (RESPECTS ACCOUNT DELETION MODE PREFERENCE) ==>
export const removeDocument = async ({
  accountId,
  entityType,
  document,
  performedBy,
}) => {
  // FETCHING THE ACCOUNT'S CURRENT DELETION PREFERENCE
  const account = await Account.findById(accountId)
    .select("deletionMode trashRetentionDays")
    .lean()
    .exec();
  // DEFAULTING TO TRASH MODE IF ACCOUNT LOOKUP SOMEHOW FAILS — SAFER FALLBACK THAN INSTANT HARD DELETE
  const deletionMode = account?.deletionMode || DELETION_MODES.TRASH;
  // IF ACCOUNT PREFERENCE IS INSTANT DELETE — HARD DELETE IMMEDIATELY, NO TRASH ENTRY CREATED
  if (deletionMode === DELETION_MODES.INSTANT) {
    // HARD DELETING THE DOCUMENT
    await document.deleteOne();
    // RETURNING TRASHED: FALSE
    return { trashed: false };
  }
  // RESOLVING EXPIRY DATE FROM THE ACCOUNT'S CURRENT RETENTION PREFERENCE
  const expiresAt = resolveExpiresAt(account?.trashRetentionDays || 30);
  // CONVERTING THE DOCUMENT TO A PLAIN SNAPSHOT OBJECT BEFORE DELETION
  const snapshot = document.toObject();
  // CREATING THE TRASH ENTRY FIRST — IF THIS FAILS, THE ORIGINAL DOCUMENT IS UNTOUCHED
  await Trash.create({
    accountId,
    entityType,
    entityId: document._id,
    snapshot,
    deletedBy: performedBy,
    expiresAt,
  });
  // HARD DELETING THE ORIGINAL DOCUMENT ONLY AFTER THE TRASH ENTRY IS SAFELY PERSISTED
  await document.deleteOne();
  // RETURNING TRASHED: TRUE
  return { trashed: true };
};

/**
 * LIST TRASHED ITEMS FOR AN ACCOUNT, OPTIONALLY FILTERED BY CATEGORY
 * @param {object} params
 * @param {string} params.accountId
 * @param {string} [params.entityType] - OPTIONAL CATEGORY FILTER
 * @param {number} params.page
 * @param {number} params.limit
 * @returns {Promise<{ records: object[], total: number }>}
 */
// <== LIST TRASH ==>
export const listTrash = async ({ accountId, entityType, page, limit }) => {
  // BUILDING BASE QUERY SCOPED TO THIS ACCOUNT
  const query = { accountId };
  // APPLYING OPTIONAL CATEGORY FILTER
  if (entityType) query.entityType = entityType;
  // CALCULATING SKIP OFFSET
  const skip = (page - 1) * limit;
  // RUNNING COUNT AND PAGINATED FETCH IN PARALLEL
  const [total, records] = await Promise.all([
    Trash.countDocuments(query),
    Trash.find(query)
      .sort({ deletedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("deletedBy", "fullName email")
      .lean()
      .exec(),
  ]);
  // RETURNING RECORDS AND TOTAL COUNT
  return { records, total };
};

/**
 * RESTORE A TRASHED ITEM BACK INTO ITS ORIGINAL COLLECTION
 * REINSERTS THE SNAPSHOT WITH ITS ORIGINAL ID AND TIMESTAMPS INTACT — THIS IS WHAT KEEPS THE RESTORED
 * ITEM LINKED TO ITS ORIGINAL CREATED AT DAY/MONTH FOR EVERY DATE-SCOPED AGGREGATION IN THE APP
 * @param {object} params - PARAMETERS FOR RESTORATION
 * @param {string} params.accountId - ACCOUNT ID FOR OWNERSHIP VERIFICATION
 * @param {string} params.trashId - THE Trash DOCUMENT'S ID
 * @returns {Promise<object|null>} - THE RESTORED DOCUMENT'S PLAIN DATA, OR NULL IF NOT FOUND
 */
// <== RESTORE FROM TRASH ==>
export const restoreFromTrash = async ({ accountId, trashId }) => {
  // FINDING THE TRASH ENTRY AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const trashEntry = await Trash.findOne({ _id: trashId, accountId })
    .lean()
    .exec();
  // IF NO MATCHING TRASH ENTRY FOUND
  if (!trashEntry) {
    // RETURNING NULL — CALLER IS RESPONSIBLE FOR THE 404 RESPONSE
    return null;
  }
  // RESOLVING THE ORIGINAL MONGOOSE MODEL DYNAMICALLY BY ITS REGISTERED NAME
  const OriginalModel = mongoose.model(trashEntry.entityType);
  // REINSERTING THE SNAPSHOT BACK INTO ITS ORIGINAL COLLECTION WITH ITS ORIGINAL ID AND TIMESTAMPS
  await OriginalModel.collection.insertOne(trashEntry.snapshot);
  // DELETING THE TRASH ENTRY NOW THAT THE ORIGINAL DOCUMENT IS BACK IN ITS COLLECTION
  await Trash.deleteOne({ _id: trashId });
  // RETURNING THE RESTORED SNAPSHOT DATA
  return trashEntry.snapshot;
};

/**
 * PERMANENTLY DELETE A SINGLE TRASH ENTRY — DISCARDS THE SNAPSHOT, UNRECOVERABLE
 * @param {object} params - PARAMETERS FOR PERMANENT DELETION
 * @param {string} params.accountId - ACCOUNT ID FOR OWNERSHIP VERIFICATION
 * @param {string} params.trashId - THE Trash DOCUMENT'S ID
 * @returns {Promise<boolean>} - TRUE IF A TRASH ENTRY WAS FOUND AND DELETED
 */
// <== PERMANENTLY DELETE FROM TRASH ==>
export const permanentlyDeleteFromTrash = async ({ accountId, trashId }) => {
  // DELETING THE TRASH ENTRY IF IT BELONGS TO THIS ACCOUNT
  const result = await Trash.deleteOne({ _id: trashId, accountId });
  // RETURNING WHETHER A DOCUMENT WAS ACTUALLY DELETED
  return result.deletedCount > 0;
};

/**
 * EMPTY THE ENTIRE TRASH FOR AN ACCOUNT, OPTIONALLY SCOPED TO A SINGLE CATEGORY
 * @param {object} params
 * @param {string} params.accountId
 * @param {string} [params.entityType] - OPTIONAL CATEGORY SCOPE — IF OMITTED, EMPTIES EVERYTHING
 * @returns {Promise<number>} - COUNT OF DELETED TRASH ENTRIES
 */
// <== EMPTY TRASH ==>
export const emptyTrash = async ({ accountId, entityType }) => {
  // BUILDING QUERY SCOPED TO THIS ACCOUNT
  const query = { accountId };
  // APPLYING OPTIONAL CATEGORY SCOPE
  if (entityType) query.entityType = entityType;
  // DELETING ALL MATCHING TRASH ENTRIES
  const result = await Trash.deleteMany(query);
  // RETURNING DELETED COUNT
  return result.deletedCount;
};
