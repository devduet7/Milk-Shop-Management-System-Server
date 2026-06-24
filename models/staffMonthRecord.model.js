// <== IMPORTS ==>
import mongoose from "mongoose";

// <== STAFF MONTH RECORD SCHEMA ==>
const staffMonthRecordSchema = new mongoose.Schema(
  {
    // STAFF MEMBER ID FIELD
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffMember",
      required: true,
    },
    // ACCOUNT ID FIELD (TENANT THIS RECORD BELONGS TO — ENABLES ACCOUNT-SCOPED QUERIES WITHOUT STAFF LOOKUP)
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    // MONTH FIELD (YYYY-MM FORMAT)
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, "Month must be in YYYY-MM Format!"],
    },
    // PAID AMOUNT FIELD — TOTAL SALARY PAID FOR THIS MONTH
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, "Paid Amount cannot be Negative!"],
    },
    // STATUS FIELD — PENDING UNTIL FULL SALARY IS PAID
    status: {
      type: String,
      enum: ["pending", "cleared"],
      default: "pending",
    },
    // TOTAL EXTRA ALLOCATED FIELD — DENORMALISED SUM OF ALL EXTRA ALLOCATIONS FOR THIS MONTH
    totalExtraAllocated: {
      type: Number,
      default: 0,
      min: [0, "Total Extra Allocated cannot be Negative!"],
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * UNIQUE COMPOUND INDEX — ONE RECORD PER STAFF MEMBER PER MONTH
 */
// <== UNIQUE COMPOUND INDEX FOR STAFF AND MONTH ==>
staffMonthRecordSchema.index({ staffId: 1, month: 1 }, { unique: true });
/**
 * COMPOUND INDEX FOR ACCOUNT AND MONTH QUERIES
 */
// <== COMPOUND INDEX FOR ACCOUNT AND MONTH QUERIES ==>
staffMonthRecordSchema.index({ accountId: 1, month: 1 });
/**
 * COMPOUND INDEX FOR ACCOUNT, STAFF, AND MONTH COMBINATION
 */
// <== COMPOUND INDEX FOR ACCOUNT, STAFF, AND MONTH COMBINATION ==>
staffMonthRecordSchema.index({ accountId: 1, staffId: 1, month: 1 });

// <== EXPORTING THE STAFF MONTH RECORD MODEL ==>
export const StaffMonthRecord = mongoose.model(
  "StaffMonthRecord",
  staffMonthRecordSchema,
);
