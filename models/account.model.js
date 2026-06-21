// <== IMPORTS ==>
import mongoose from "mongoose";

// <== ACCOUNT STATUS CONSTANTS ==>
export const ACCOUNT_STATUSES = {
  // <== ACCOUNT IS ACTIVE AND CAN BE LOGGED INTO ==>
  ACTIVE: "active",
  // <== ACCOUNT HAS BEEN SUSPENDED — ALL USERS UNDER IT ARE BLOCKED FROM LOGGING IN ==>
  SUSPENDED: "suspended",
};

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
