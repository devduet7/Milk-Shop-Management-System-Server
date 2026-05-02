// <== IMPORTS ==>
import mongoose from "mongoose";

// <== QUICK SALE SCHEMA ==>
const quickSaleSchema = new mongoose.Schema(
  {
    // USER ID FIELD (OWNER OF THIS QUICK SALE RECORD)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // TYPE FIELD — MILK OR YOGHURT
    type: {
      type: String,
      enum: ["milk", "yoghurt"],
      required: true,
    },
    // QUANTITY FIELD (IN LITERS FOR MILK, KG FOR YOGHURT)
    quantity: {
      type: Number,
      required: true,
      min: [0.1, "Quantity must be at least 0.1!"],
    },
    // RATE FIELD (PRICE PER UNIT IN RUPEES)
    rate: {
      type: Number,
      required: true,
      min: [1, "Rate must be at least ₨1!"],
    },
    // TOTAL FIELD — DERIVED AS QUANTITY * RATE, STORED DENORMALISED TO AVOID MULTIPLICATION AT QUERY TIME
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be Negative!"],
    },
    // DATE FIELD (YYYY-MM-DD — FOR DATE-RANGE FILTERING)
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD Format!"],
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
 * COMPOUND INDEX FOR USER AND DATE — PRIMARY QUERY AND SORT PATTERN
 */
// <== COMPOUND INDEX FOR USER AND DATE ==>
quickSaleSchema.index({ userId: 1, date: -1 });
/**
 * COMPOUND INDEX FOR USER, TYPE, AND DATE — PRODUCT FILTER QUERIES
 */
// <== COMPOUND INDEX FOR USER, TYPE, AND DATE ==>
quickSaleSchema.index({ userId: 1, type: 1, date: -1 });
/**
 * COMPOUND INDEX FOR USER, DATE RANGE, AND TYPE — AGGREGATION QUERIES
 */
// <== COMPOUND INDEX FOR USER, DATE RANGE, AND TYPE ==>
quickSaleSchema.index({ userId: 1, date: 1, type: 1 });

// <== EXPORTING THE QUICK SALE MODEL ==>
export const QuickSale = mongoose.model("QuickSale", quickSaleSchema);
