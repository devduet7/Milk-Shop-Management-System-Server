// <== IMPORTS ==>
import mongoose from "mongoose";

// <== QUICK SALE SCHEMA ==>
const quickSaleSchema = new mongoose.Schema(
  {
    // ACCOUNT ID FIELD (TENANT THIS QUICK SALE RECORD BELONGS TO — SHARED ACROSS THE WHOLE TEAM)
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
    // SUBTOTAL FIELD — DERIVED AS QUANTITY * RATE, BEFORE DISCOUNT — STORED FOR REPORTING
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be Negative!"],
    },
    // DISCOUNT FIELD (MONEY KNOCKED OFF THE SUBTOTAL — NEVER A PERCENTAGE)
    discount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Discount cannot be Negative!"],
    },
    // TOTAL FIELD (DERIVED: SUBTOTAL - DISCOUNT — STORED FOR REPORTING)
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
 * COMPOUND INDEX FOR ACCOUNT AND DATE — PRIMARY QUERY AND SORT PATTERN
 */
// <== COMPOUND INDEX FOR ACCOUNT AND DATE ==>
quickSaleSchema.index({ accountId: 1, date: -1 });
/**
 * COMPOUND INDEX FOR ACCOUNT, TYPE, AND DATE — PRODUCT FILTER QUERIES
 */
// <== COMPOUND INDEX FOR ACCOUNT, TYPE, AND DATE ==>
quickSaleSchema.index({ accountId: 1, type: 1, date: -1 });
/**
 * COMPOUND INDEX FOR ACCOUNT, DATE RANGE, AND TYPE — AGGREGATION QUERIES
 */
// <== COMPOUND INDEX FOR ACCOUNT, DATE RANGE, AND TYPE ==>
quickSaleSchema.index({ accountId: 1, date: 1, type: 1 });

// <== EXPORTING THE QUICK SALE MODEL ==>
export const QuickSale = mongoose.model("QuickSale", quickSaleSchema);
