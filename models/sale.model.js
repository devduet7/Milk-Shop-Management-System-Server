// <== IMPORTS ==>
import mongoose from "mongoose";

// <== SALE SCHEMA ==>
const saleSchema = new mongoose.Schema(
  {
    // ACCOUNT ID FIELD (TENANT THIS SALE RECORD BELONGS TO — SHARED ACROSS THE WHOLE TEAM)
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
    // SALE TYPE FIELD
    saleType: {
      type: String,
      required: true,
      enum: {
        values: ["customer", "shop"],
        message: "Sale Type must be customer or shop!",
      },
      index: true,
    },
    // CUSTOMER NAME FIELD (ONLY FOR CUSTOMER SALES — NULL FOR SHOP SALES)
    customerName: {
      type: String,
      default: null,
      trim: true,
      maxlength: [150, "Customer Name must not exceed 150 Characters!"],
    },
    // PRODUCT TYPE FIELD (milk = LITERS | yoghurt = KILOGRAMS)
    productType: {
      type: String,
      required: true,
      enum: {
        values: ["milk", "yoghurt"],
        message: "Product Type must be milk or yoghurt!",
      },
      index: true,
    },
    // QUANTITY FIELD (LITERS FOR MILK, KILOGRAMS FOR YOGHURT)
    quantity: {
      type: Number,
      required: true,
      min: [0.1, "Quantity must be at least 0.1!"],
    },
    // PRICE PER UNIT FIELD (₨ PER LITER OR ₨ PER KG)
    pricePerUnit: {
      type: Number,
      required: true,
      min: [1, "Price per Unit must be at least ₨1!"],
    },
    // TOTAL AMOUNT FIELD (DERIVED: QUANTITY × PRICE PER UNIT — STORED FOR PERFORMANCE)
    totalAmount: {
      type: Number,
      required: true,
      min: [0, "Total Amount cannot be Negative!"],
    },
    // PAID AMOUNT FIELD
    paidAmount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Paid Amount cannot be Negative!"],
    },
    // PENDING AMOUNT FIELD
    pendingAmount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Pending Amount cannot be Negative!"],
      index: true,
    },
    // DATE FIELD (YYYY-MM-DD STRING — CONSISTENT WITH OTHER MODELS)
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
 * COMPOUND INDEX FOR ACCOUNT, SALE TYPE, AND DATE (PRIMARY QUERY PATTERN)
 */
// <== COMPOUND INDEX FOR ACCOUNT, SALE TYPE, AND DATE ==>
saleSchema.index({ accountId: 1, saleType: 1, date: -1 });
/**
 * COMPOUND INDEX FOR ACCOUNT, SALE TYPE, AND PRODUCT TYPE
 */
// <== COMPOUND INDEX FOR ACCOUNT, SALE TYPE, AND PRODUCT TYPE ==>
saleSchema.index({ accountId: 1, saleType: 1, productType: 1 });
/**
 * COMPOUND INDEX FOR COMBINATION FILTER (ACCOUNT + SALE TYPE + DATE + PRODUCT TYPE)
 */
// <== COMPOUND INDEX FOR COMBINATION FILTER ==>
saleSchema.index({ accountId: 1, saleType: 1, date: -1, productType: 1 });
/**
 * COMPOUND INDEX FOR PENDING BALANCE FILTER ON CUSTOMER SALES
 */
// <== COMPOUND INDEX FOR PENDING FILTER ==>
saleSchema.index({ accountId: 1, saleType: 1, pendingAmount: 1 });
/**
 * COMPOUND INDEX FOR ACCOUNT AND CREATION DATE SORTING
 */
// <== COMPOUND INDEX FOR ACCOUNT AND CREATION DATE ==>
saleSchema.index({ accountId: 1, createdAt: -1 });

// <== EXPORTING THE SALE MODEL ==>
export const Sale = mongoose.model("Sale", saleSchema);
