// <== IMPORTS ==>
import mongoose from "mongoose";

// <== DELIVERY RECORD SCHEMA ==>
const deliveryRecordSchema = new mongoose.Schema(
  {
    // CUSTOMER ID FIELD
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    // ACCOUNT ID FIELD (TENANT THIS RECORD BELONGS TO — ENABLES ACCOUNT-SCOPED QUERIES WITHOUT CUSTOMER LOOKUP)
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    // PERFORMED BY FIELD (THE USER WHO LAST MARKED THIS DELIVERY — FOR ATTRIBUTION)
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // DATE FIELD (STORED AS YYYY-MM-DD STRING FOR EASY RANGE QUERIES)
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD Format!"],
    },
    // MILK QUANTITY DELIVERED ON THIS DATE (IN LITERS)
    milkQuantity: {
      type: Number,
      required: true,
      min: [0, "Milk Quantity Cannot be Negative!"],
      default: 0,
    },
    // DELIVERY STATUS FIELD
    status: {
      type: String,
      enum: {
        values: ["delivered", "missed", "unmarked"],
        message: "Status must be delivered, missed, or unmarked!",
      },
      default: "unmarked",
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * UNIQUE COMPOUND INDEX: ENFORCES ONE RECORD PER CUSTOMER PER DATE
 */
// <== UNIQUE COMPOUND INDEX FOR CUSTOMER AND DATE ==>
deliveryRecordSchema.index({ customerId: 1, date: 1 }, { unique: true });
/**
 * COMPOUND INDEX FOR MONTHLY DELIVERED QUERIES
 */
// <== COMPOUND INDEX FOR MONTHLY DELIVERED QUERIES ==>
deliveryRecordSchema.index({ customerId: 1, date: 1, status: 1 });
/**
 * COMPOUND INDEX FOR ACCOUNT-LEVEL DATE RANGE QUERIES
 */
// <== COMPOUND INDEX FOR ACCOUNT-LEVEL DATE RANGE QUERIES ==>
deliveryRecordSchema.index({ accountId: 1, date: 1 });

// <== EXPORTING THE DELIVERY RECORD MODEL ==>
export const DeliveryRecord = mongoose.model(
  "DeliveryRecord",
  deliveryRecordSchema,
);
