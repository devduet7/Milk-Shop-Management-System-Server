// <== IMPORTS ==>
import mongoose from "mongoose";

// <== PURCHASE SCHEMA ==>
const purchaseSchema = new mongoose.Schema(
  {
    // USER ID FIELD (OWNER OF THIS PURCHASE RECORD)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // SUPPLIER NAME FIELD
    supplier: {
      type: String,
      required: true,
      trim: true,
      maxlength: [150, "Supplier Name must not exceed 150 Characters!"],
    },
    // MILK QUANTITY FIELD (IN LITERS)
    milkQuantity: {
      type: Number,
      required: true,
      min: [0.5, "Milk Quantity must be at least 0.5 Liters!"],
    },
    // TOTAL COST FIELD (IN RUPEES)
    totalCost: {
      type: Number,
      required: true,
      min: [1, "Total Cost must be at least ₨1!"],
    },
    // PRICE PER LITER FIELD (DERIVED — COMPUTED ON WRITE)
    pricePerLiter: {
      type: Number,
      required: true,
      min: [0, "Price per Liter cannot be Negative!"],
    },
    // DATE FIELD (YYYY-MM-DD STRING — CONSISTENT WITH EXPENDITURE PATTERN)
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
 * COMPOUND INDEX FOR USER AND DATE SORTING (PRIMARY QUERY PATTERN)
 */
// <== COMPOUND INDEX FOR USER AND DATE ==>
purchaseSchema.index({ userId: 1, date: -1 });
/**
 * COMPOUND INDEX FOR USER AND SUPPLIER (SUPPLIER SEARCH PATTERN)
 */
// <== COMPOUND INDEX FOR USER AND SUPPLIER ==>
purchaseSchema.index({ userId: 1, supplier: 1 });
/**
 * COMPOUND INDEX FOR COMBINATION FILTER (USER + DATE RANGE + SUPPLIER)
 */
// <== COMPOUND INDEX FOR COMBINATION FILTER ==>
purchaseSchema.index({ userId: 1, date: -1, supplier: 1 });
/**
 * COMPOUND INDEX FOR USER AND CREATION DATE SORTING
 */
// <== COMPOUND INDEX FOR USER AND CREATION DATE ==>
purchaseSchema.index({ userId: 1, createdAt: -1 });

// <== EXPORTING THE PURCHASE MODEL ==>
export const Purchase = mongoose.model("Purchase", purchaseSchema);
