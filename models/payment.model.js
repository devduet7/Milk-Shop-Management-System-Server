// <== IMPORTS ==>
import mongoose from "mongoose";

// <== PAYMENT SCHEMA ==>
const paymentSchema = new mongoose.Schema(
  {
    // CUSTOMER ID FIELD
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    // USER ID FIELD
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // AMOUNT FIELD (IN RUPEES)
    amount: {
      type: Number,
      required: true,
      min: [1, "Payment Amount must be at least ₨1!"],
    },
    // BILLING MONTH FIELD (YYYY-MM — WHICH MONTH'S BILL THIS PAYMENT COVERS)
    billingMonth: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, "Billing Month must be in YYYY-MM Format!"],
      index: true,
    },
    // PAYMENT DATE FIELD (YYYY-MM-DD — ACTUAL DATE PAYMENT WAS RECEIVED)
    paymentDate: {
      type: String,
      required: true,
      match: [
        /^\d{4}-\d{2}-\d{2}$/,
        "Payment Date must be in YYYY-MM-DD Format!",
      ],
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
 * COMPOUND INDEX FOR CUSTOMER BILLING MONTH PAYMENT QUERIES
 */
// <== COMPOUND INDEX FOR CUSTOMER BILLING MONTH PAYMENT QUERIES ==>
paymentSchema.index({ customerId: 1, billingMonth: 1 });
/**
 * COMPOUND INDEX FOR USER-LEVEL PAYMENT QUERIES
 */
// <== COMPOUND INDEX FOR USER-LEVEL PAYMENT QUERIES ==>
paymentSchema.index({ userId: 1, billingMonth: 1 });

// <== EXPORTING THE PAYMENT MODEL ==>
export const Payment = mongoose.model("Payment", paymentSchema);
