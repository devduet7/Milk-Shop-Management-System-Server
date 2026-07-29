// <== IMPORTS ==>
import mongoose from "mongoose";

// <== MILK LOG SCHEMA ==>
const milkLogSchema = new mongoose.Schema(
  {
    // ACCOUNT ID FIELD (TENANT THIS MILK LOG RECORD BELONGS TO — SHARED ACROSS THE WHOLE TEAM)
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    // PERFORMED BY FIELD (THE USER WHO CREATED THIS RECORD — FOR ATTRIBUTION, NOT OWNERSHIP)
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // TYPE FIELD — LEFTOVER CARRIED FROM THE PREVIOUS DAY, OR MILK USED FOR YOGHURT
    type: {
      type: String,
      enum: ["leftover", "yoghurt"],
      required: true,
    },
    // QUANTITY FIELD (IN LITERS) — ZERO IS A VALID VALUE
    quantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be Negative!"],
    },
    // DATE FIELD (YYYY-MM-DD STRING)
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD Format!"],
      index: true,
    },
    // NOTE FIELD (OPTIONAL)
    note: {
      type: String,
      default: null,
      trim: true,
      maxlength: [300, "Note must not exceed 300 Characters!"],
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * COMPOUND INDEX FOR ACCOUNT AND DATE SORTING (PRIMARY QUERY PATTERN)
 */
// <== COMPOUND INDEX FOR ACCOUNT AND DATE ==>
milkLogSchema.index({ accountId: 1, date: -1 });
/**
 * COMPOUND INDEX FOR ACCOUNT, TYPE, AND DATE — TYPE FILTER QUERIES
 */
// <== COMPOUND INDEX FOR ACCOUNT, TYPE, AND DATE ==>
milkLogSchema.index({ accountId: 1, type: 1, date: -1 });
/**
 * COMPOUND INDEX FOR ACCOUNT AND CREATION DATE SORTING
 */
// <== COMPOUND INDEX FOR ACCOUNT AND CREATION DATE ==>
milkLogSchema.index({ accountId: 1, createdAt: -1 });

// <== EXPORTING THE MILK LOG MODEL ==>
export const MilkLog = mongoose.model("MilkLog", milkLogSchema);
