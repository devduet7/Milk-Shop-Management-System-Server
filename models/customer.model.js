// <== IMPORTS ==>
import mongoose from "mongoose";

// <== CUSTOMER SCHEMA ==>
const customerSchema = new mongoose.Schema(
  {
    // ACCOUNT ID FIELD (TENANT THIS CUSTOMER RECORD BELONGS TO — SHARED ACROSS THE WHOLE TEAM)
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
    // NAME FIELD
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // PHONE FIELD (OPTIONAL)
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    // ADDRESS FIELD (OPTIONAL)
    address: {
      type: String,
      default: null,
      trim: true,
    },
    // DAILY MILK FIELD (IN LITERS)
    dailyMilk: {
      type: Number,
      required: true,
      min: [0.5, "Daily Milk must be at least 0.5 Liters!"],
    },
    // PRICE PER LITER FIELD (IN RUPEES)
    pricePerLiter: {
      type: Number,
      required: true,
      min: [1, "Price per Liter must be at least 1!"],
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * TEXT INDEX FOR SEARCH FUNCTIONALITY
 */
// <== TEXT INDEX FOR SEARCH FUNCTIONALITY ==>
customerSchema.index({ name: "text", phone: "text", address: "text" });
/**
 * COMPOUND INDEX FOR ACCOUNT AND NAME QUERIES
 */
// <== COMPOUND INDEX FOR ACCOUNT AND NAME QUERIES ==>
customerSchema.index({ accountId: 1, name: 1 });
/**
 * COMPOUND INDEX FOR ACCOUNT AND CREATION DATE SORTING
 */
// <== COMPOUND INDEX FOR ACCOUNT AND CREATION DATE SORTING ==>
customerSchema.index({ accountId: 1, createdAt: -1 });

// <== EXPORTING THE CUSTOMER MODEL ==>
export const Customer = mongoose.model("Customer", customerSchema);
