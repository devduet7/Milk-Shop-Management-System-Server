// <== IMPORTS ==>
import {
  listTrash as listTrashService,
  emptyTrash as emptyTrashService,
  restoreFromTrash as restoreFromTrashService,
  permanentlyDeleteFromTrash as permanentlyDeleteFromTrashService,
} from "../services/trashService.js";
import expressAsyncHandler from "express-async-handler";
import { TRASH_ENTITY_TYPES } from "../models/trash.model.js";

/**
 * GET PAGINATED TRASH LISTING, OPTIONALLY FILTERED BY CATEGORY
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET TRASH ==>
export const getTrash = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING OPTIONAL CATEGORY FILTER FROM QUERY
  const entityType = req.query.entityType || undefined;
  // PARSING PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  // PARSING LIMIT PER PAGE
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  // FETCHING TRASH RECORDS VIA SERVICE
  const { records, total } = await listTrashService({
    accountId,
    entityType,
    page,
    limit,
  });
  // COMPUTING TOTAL PAGES
  const totalPages = Math.ceil(total / limit);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Trash Fetched Successfully!",
    success: true,
    data: {
      records,
      categories: Object.values(TRASH_ENTITY_TYPES),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * RESTORE A SINGLE TRASHED ITEM BACK TO ITS ORIGINAL COLLECTION
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== RESTORE TRASH ITEM ==>
export const restoreTrashItem = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING TRASH ENTRY ID FROM REQUEST PARAMS
  const { id } = req.params;
  // ATTEMPTING TO RESTORE THE TRASH ENTRY
  const restoredDocument = await restoreFromTrashService({
    accountId,
    trashId: id,
  });
  // IF NO MATCHING TRASH ENTRY WAS FOUND
  if (!restoredDocument) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "Trash Item Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // RETURNING SUCCESS RESPONSE WITH RESTORED DOCUMENT
  res.status(200).json({
    message: "Item Restored Successfully!",
    success: true,
    data: { restored: restoredDocument },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * PERMANENTLY DELETE A SINGLE TRASHED ITEM — DISCARDS THE SNAPSHOT, UNRECOVERABLE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== PERMANENTLY DELETE TRASH ITEM ==>
export const permanentlyDeleteTrashItem = expressAsyncHandler(
  async (req, res) => {
    // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
    const accountId = req.accountId;
    // GETTING TRASH ENTRY ID FROM REQUEST PARAMS
    const { id } = req.params;
    // ATTEMPTING TO PERMANENTLY DELETE THE TRASH ENTRY
    const deleted = await permanentlyDeleteFromTrashService({
      accountId,
      trashId: id,
    });
    // IF NO MATCHING TRASH ENTRY WAS FOUND
    if (!deleted) {
      // RETURNING NOT FOUND RESPONSE
      res
        .status(404)
        .json({ message: "Trash Item Not Found!", success: false });
      // RETURNING FROM FUNCTION
      return;
    }
    // RETURNING SUCCESS RESPONSE
    res.status(200).json({
      message: "Item Permanently Deleted!",
      success: true,
    });
    // RETURNING FROM FUNCTION
    return;
  },
);

/**
 * EMPTY THE ENTIRE TRASH FOR THIS ACCOUNT, OPTIONALLY SCOPED TO A SINGLE CATEGORY
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== EMPTY TRASH ==>
export const emptyTrashHandler = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING OPTIONAL CATEGORY SCOPE FROM QUERY
  const entityType = req.query.entityType || undefined;
  // EMPTYING TRASH VIA SERVICE
  const deletedCount = await emptyTrashService({ accountId, entityType });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: `${deletedCount} Item${deletedCount === 1 ? "" : "s"} Permanently Deleted from Trash!`,
    success: true,
    data: { deletedCount },
  });
  // RETURNING FROM FUNCTION
  return;
});
