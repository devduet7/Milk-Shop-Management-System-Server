// <== IMPORTS ==>
import mongoose from "mongoose";

// <== STAFF EXTRA ALLOCATION SCHEMA ==>
const staffExtraAllocationSchema = new mongoose.Schema(
  {
    // STAFF MEMBER ID FIELD
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffMember",
      required: true,
    },
    // USER ID FIELD (OWNER OF THIS RECORD)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // MONTH FIELD (YYYY-MM) — LINKS ALLOCATION TO A SPECIFIC BILLING MONTH
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, "Month must be in YYYY-MM Format!"],
    },
    // DATE FIELD (YYYY-MM-DD) — EXACT DATE THE EXTRA AMOUNT WAS GIVEN
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD Format!"],
    },
    // AMOUNT FIELD — EXTRA MONEY ALLOCATED
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be at least ₨1!"],
    },
    // NOTE FIELD (OPTIONAL)
    note: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * COMPOUND INDEX FOR STAFF AND MONTH QUERIES
 */
// <== COMPOUND INDEX FOR STAFF AND MONTH QUERIES ==>
staffExtraAllocationSchema.index({ staffId: 1, month: 1 });
/**
 * COMPOUND INDEX FOR USER AND MONTH QUERIES
 */
// <== COMPOUND INDEX FOR USER AND MONTH QUERIES ==>
staffExtraAllocationSchema.index({ userId: 1, month: 1 });
/**
 * COMPOUND INDEX FOR STAFF AND DATE SORTING WITHIN A MONTH
 */
// <== COMPOUND INDEX FOR STAFF, MONTH, AND DATE SORTING ==>
staffExtraAllocationSchema.index({ staffId: 1, month: 1, date: -1 });

// <== EXPORTING THE STAFF EXTRA ALLOCATION MODEL ==>
export const StaffExtraAllocation = mongoose.model(
  "StaffExtraAllocation",
  staffExtraAllocationSchema,
);
