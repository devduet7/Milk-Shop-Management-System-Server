// <== IMPORTS ==>
import mongoose from "mongoose";

// <== ACCOUNT STATUS CONSTANTS ==>
export const ACCOUNT_STATUSES = {
  // <== ACCOUNT IS ACTIVE ==>
  ACTIVE: "active",
  // <== ACCOUNT HAS BEEN SUSPENDED ==>
  SUSPENDED: "suspended",
};

// <== DELETION MODE CONSTANTS ==>
export const DELETION_MODES = {
  // <== DELETES ACROSS THIS ACCOUNT GO TO TRASH ==>
  TRASH: "trash",
  // <== DELETES ACROSS THIS ACCOUNT ARE REMOVED INSTANTLY ==>
  INSTANT: "instant",
};

// <== TRASH RETENTION DAYS CONSTANTS — THE ONLY ALLOWED AUTO-PURGE WINDOWS ==>
export const TRASH_RETENTION_OPTIONS = [7, 15, 30];

// <== ACCOUNT SCHEMA ==>
const accountSchema = new mongoose.Schema(
  {
    // BUSINESS NAME FIELD
    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, "Business Name must not exceed 120 Characters!"],
    },
    // ACCOUNT STATUS FIELD
    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUSES),
      default: ACCOUNT_STATUSES.ACTIVE,
    },
    // SUSPENDED AT TIMESTAMP — NULL UNLESS STATUS IS SUSPENDED
    suspendedAt: {
      type: Date,
      default: null,
    },
    // SUSPENDED REASON — OPTIONAL INTERNAL NOTE FOR WHY THE ACCOUNT WAS SUSPENDED
    suspendedReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: [300, "Suspended Reason must not exceed 300 Characters!"],
    },
    // MILK RATE FIELD (PRICE PER LITER IN RUPEES — BUSINESS-WIDE CONFIGURATION, SHARED ACROSS ALL USERS)
    milkRate: {
      type: Number,
      default: 120,
      min: [1, "Milk Rate must be at least ₨1!"],
    },
    // YOGHURT RATE FIELD (PRICE PER KG IN RUPEES — BUSINESS-WIDE CONFIGURATION, SHARED ACROSS ALL USERS)
    yoghurtRate: {
      type: Number,
      default: 180,
      min: [1, "Yoghurt Rate must be at least ₨1!"],
    },
    // DAILY REPORTS ENABLED FLAG — CONTROLS WHETHER AUTOMATED DAILY REPORTS ARE SENT
    dailyReportsEnabled: {
      type: Boolean,
      default: false,
    },
    // MONTHLY REPORTS ENABLED FLAG — CONTROLS WHETHER AUTOMATED MONTHLY REPORTS ARE SENT
    monthlyReportsEnabled: {
      type: Boolean,
      default: false,
    },
    // LAST DAILY REPORT SENT DATE (YYYY-MM-DD) — IDEMPOTENCY GUARD FOR DAILY CRON
    lastDailyReportSentDate: {
      type: String,
      default: null,
      match: [
        /^\d{4}-\d{2}-\d{2}$/,
        "Last Daily Report Sent Date must be in YYYY-MM-DD Format!",
      ],
    },
    // LAST MONTHLY REPORT SENT MONTH (YYYY-MM) — IDEMPOTENCY GUARD FOR MONTHLY CRON
    lastMonthlyReportSentDate: {
      type: String,
      default: null,
      match: [
        /^\d{4}-\d{2}$/,
        "Last Monthly Report Sent Date must be in YYYY-MM Format!",
      ],
    },
    // DELETION MODE FIELD — WHETHER DELETES ACROSS THIS ACCOUNT GO TO TRASH OR ARE REMOVED INSTANTLY
    deletionMode: {
      type: String,
      enum: Object.values(DELETION_MODES),
      default: DELETION_MODES.TRASH,
    },
    // TRASH RETENTION DAYS FIELD — HOW LONG TRASHED ITEMS ARE KEPT BEFORE AUTO-PURGE
    trashRetentionDays: {
      type: Number,
      enum: TRASH_RETENTION_OPTIONS,
      default: 30,
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * INDEX FOR FILTERING ACCOUNTS BY STATUS
 */
// <== INDEX FOR STATUS LOOKUPS ==>
accountSchema.index({ status: 1 });

// <== EXPORTING THE ACCOUNT MODEL ==>
export const Account = mongoose.model("Account", accountSchema);
