// <== IMPORTS ==>
import mongoose from "mongoose";

// <== TRASH ENTITY TYPE CONSTANTS  ==>
export const TRASH_ENTITY_TYPES = {
  SALE: "Sale",
  MILK_LOG: "MilkLog",
  CUSTOMER: "Customer",
  PURCHASE: "Purchase",
  QUICK_SALE: "QuickSale",
  EXPENDITURE: "Expenditure",
  STAFF_MEMBER: "StaffMember",
};

// <== TRASH SCHEMA ==>
const trashSchema = new mongoose.Schema(
  {
    // ACCOUNT REFERENCE FIELD
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    // ENTITY TYPE FIELD
    entityType: {
      type: String,
      enum: Object.values(TRASH_ENTITY_TYPES),
      required: true,
    },
    // ENTITY ID FIELD
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // SNAPSHOT FIELD
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // DELETED BY FIELD
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // DELETED AT FIELD
    deletedAt: {
      type: Date,
      default: Date.now,
    },
    // EXPIRES AT FIELD
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * TTL INDEX — MONGODB AUTOMATICALLY DELETES EXPIRED TRASH DOCUMENTS
 */
// <== TTL INDEX FOR AUTOMATIC EXPIRY-BASED PURGE ==>
trashSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
/**
 * COMPOUND INDEX FOR LISTING TRASH BY ACCOUNT AND CATEGORY, SORTED BY MOST RECENTLY DELETED
 */
// <== COMPOUND INDEX FOR ACCOUNT + ENTITY TYPE CATEGORY LISTINGS ==>
trashSchema.index({ accountId: 1, entityType: 1, deletedAt: -1 });
/**
 * UNIQUE COMPOUND INDEX — PREVENTS THE SAME ORIGINAL DOCUMENT FROM EXISTING IN TRASH MORE THAN ONCE
 */
// <== UNIQUE INDEX PREVENTING DUPLICATE TRASH ENTRIES FOR THE SAME ENTITY ==>
trashSchema.index(
  { accountId: 1, entityType: 1, entityId: 1 },
  { unique: true },
);

// <== EXPORTING THE TRASH MODEL ==>
export const Trash = mongoose.model("Trash", trashSchema);
