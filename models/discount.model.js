// <== IMPORTS ==>
import mongoose from "mongoose";

// <== DISCOUNT SCHEMA ==>
const discountSchema = new mongoose.Schema(
  {
    // CUSTOMER ID FIELD
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    // ACCOUNT ID FIELD (TENANT THIS DISCOUNT BELONGS TO — ENABLES ACCOUNT-SCOPED QUERIES WITHOUT CUSTOMER LOOKUP)
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    // PERFORMED BY FIELD (THE USER WHO SET THIS DISCOUNT — FOR ATTRIBUTION)
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // AMOUNT FIELD (IN RUPEES — HOW MUCH IS KNOCKED OFF THIS BILLING MONTH'S TOTAL)
    amount: {
      type: Number,
      required: true,
      min: [1, "Discount Amount must be at least ₨1!"],
    },
    // BILLING MONTH FIELD (YYYY-MM — WHICH MONTH'S BILL THIS DISCOUNT APPLIES TO)
    billingMonth: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, "Billing Month must be in YYYY-MM Format!"],
      index: true,
    },
    // NOTE FIELD (OPTIONAL)
    note: {
      type: String,
      default: null,
      trim: true,
      maxlength: [200, "Note must not exceed 200 Characters!"],
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * UNIQUE COMPOUND INDEX — ONE DISCOUNT PER CUSTOMER PER BILLING MONTH
 */
// <== UNIQUE COMPOUND INDEX FOR CUSTOMER AND BILLING MONTH ==>
discountSchema.index({ customerId: 1, billingMonth: 1 }, { unique: true });
/**
 * COMPOUND INDEX FOR ACCOUNT-LEVEL DISCOUNT QUERIES
 */
// <== COMPOUND INDEX FOR ACCOUNT-LEVEL DISCOUNT QUERIES ==>
discountSchema.index({ accountId: 1, billingMonth: 1 });

// <== EXPORTING THE DISCOUNT MODEL ==>
export const Discount = mongoose.model("Discount", discountSchema);
