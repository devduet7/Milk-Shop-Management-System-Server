// <== IMPORTS ==>
import mongoose from "mongoose";

// <== STAFF MEMBER SCHEMA ==>
const staffMemberSchema = new mongoose.Schema(
  {
    // USER ID FIELD (OWNER OF THIS STAFF RECORD)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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
 * COMPOUND INDEX FOR USER AND NAME QUERIES
 */
// <== COMPOUND INDEX FOR USER AND NAME QUERIES ==>
staffMemberSchema.index({ userId: 1, name: 1 });
/**
 * COMPOUND INDEX FOR USER AND CREATION DATE SORTING
 */
// <== COMPOUND INDEX FOR USER AND CREATION DATE SORTING ==>
staffMemberSchema.index({ userId: 1, createdAt: -1 });

// <== EXPORTING THE STAFF MEMBER MODEL ==>
export const StaffMember = mongoose.model("StaffMember", staffMemberSchema);
