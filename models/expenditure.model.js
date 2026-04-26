// <== IMPORTS ==>
import mongoose from "mongoose";

// <== EXPENDITURE SCHEMA ==>
const expenditureSchema = new mongoose.Schema(
  {
    // USER ID FIELD (OWNER OF THIS EXPENDITURE RECORD)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // TITLE FIELD
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // CATEGORY FIELD (SUPPLIES | MEALS | TRANSPORT | MISC)
    category: {
      type: String,
      required: true,
      enum: {
        values: ["supplies", "meals", "transport", "misc"],
        message: "Category must be supplies, meals, transport, or misc!",
      },
      index: true,
    },
    // AMOUNT FIELD (IN RUPEES)
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be at least ₨1!"],
    },
    // DATE FIELD (YYYY-MM-DD STRING — CONSISTENT WITH DELIVERY RECORD PATTERN)
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
 * TEXT INDEX FOR FULL-TEXT SEARCH ON TITLE AND NOTE
 */
// <== TEXT INDEX FOR TITLE AND NOTE SEARCH ==>
expenditureSchema.index({ title: "text", note: "text" });
/**
 * COMPOUND INDEX FOR USER AND DATE SORTING (PRIMARY QUERY PATTERN)
 */
// <== COMPOUND INDEX FOR USER AND DATE ==>
expenditureSchema.index({ userId: 1, date: -1 });
/**
 * COMPOUND INDEX FOR USER AND CATEGORY FILTERING
 */
// <== COMPOUND INDEX FOR USER AND CATEGORY ==>
expenditureSchema.index({ userId: 1, category: 1 });
/**
 * COMPOUND INDEX FOR COMBINATION FILTER (USER + DATE RANGE + CATEGORY)
 */
// <== COMPOUND INDEX FOR COMBINATION FILTER ==>
expenditureSchema.index({ userId: 1, date: -1, category: 1 });
/**
 * COMPOUND INDEX FOR USER AND CREATION DATE SORTING
 */
// <== COMPOUND INDEX FOR USER AND CREATION DATE ==>
expenditureSchema.index({ userId: 1, createdAt: -1 });

// <== EXPORTING THE EXPENDITURE MODEL ==>
export const Expenditure = mongoose.model("Expenditure", expenditureSchema);
