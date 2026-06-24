// <== IMPORTS ==>
import mongoose from "mongoose";

// <== STAFF MEMBER SCHEMA ==>
const staffMemberSchema = new mongoose.Schema(
  {
    // ACCOUNT ID FIELD (TENANT THIS STAFF RECORD BELONGS TO — SHARED ACROSS THE WHOLE TEAM)
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    // PERFORMED BY FIELD (THE USER WHO CREATED THIS STAFF RECORD — FOR ATTRIBUTION)
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // NAME FIELD
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // MONTHLY SALARY FIELD (IN RUPEES)
    monthlySalary: {
      type: Number,
      required: true,
      min: [1, "Monthly Salary must be at least ₨1!"],
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
 * COMPOUND INDEX FOR ACCOUNT AND NAME QUERIES
 */
// <== COMPOUND INDEX FOR ACCOUNT AND NAME QUERIES ==>
staffMemberSchema.index({ accountId: 1, name: 1 });
/**
 * COMPOUND INDEX FOR ACCOUNT AND CREATION DATE SORTING
 */
// <== COMPOUND INDEX FOR ACCOUNT AND CREATION DATE SORTING ==>
staffMemberSchema.index({ accountId: 1, createdAt: -1 });

// <== EXPORTING THE STAFF MEMBER MODEL ==>
export const StaffMember = mongoose.model("StaffMember", staffMemberSchema);
