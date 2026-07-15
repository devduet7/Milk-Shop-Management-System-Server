// <== IMPORTS ==>
import mongoose from "mongoose";

// <== DEVICE TYPE CONSTANTS ==>
export const DEVICE_TYPES = {
  DESKTOP: "desktop",
  MOBILE: "mobile",
  TABLET: "tablet",
  UNKNOWN: "unknown",
};

// <== SESSION SCHEMA ==>
const sessionSchema = new mongoose.Schema(
  {
    // USER ID FIELD
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // ACCOUNT ID FIELD
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    // DEVICE TYPE FIELD
    deviceType: {
      type: String,
      enum: Object.values(DEVICE_TYPES),
      default: DEVICE_TYPES.UNKNOWN,
    },
    // BROWSER FIELD
    browser: {
      type: String,
      default: "Unknown Browser",
    },
    // OPERATING SYSTEM FIELD
    os: {
      type: String,
      default: "Unknown OS",
    },
    // IP ADDRESS FIELD
    ipAddress: {
      type: String,
      default: null,
    },
    // RAW USER-AGENT STRING
    userAgent: {
      type: String,
      default: null,
    },
    // ACTIVE FLAG
    isActive: {
      type: Boolean,
      default: true,
    },
    // LOGIN TIMESTAMP
    loginAt: {
      type: Date,
      default: Date.now,
    },
    // LAST ACTIVE TIMESTAMP
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    // LOGOUT TIMESTAMP
    logoutAt: {
      type: Date,
      default: null,
    },
    // REVOKED BY FIELD
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // REVOKED AT FIELD
    revokedAt: {
      type: Date,
      default: null,
    },
    // EXPIRES AT FIELD
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * COMPOUND INDEX FOR "MY ACTIVE SESSIONS" AND "THIS USER'S ACTIVE SESSIONS" QUERIES
 */
// <== COMPOUND INDEX FOR USER AND ACTIVE STATUS ==>
sessionSchema.index({ userId: 1, isActive: 1 });
/**
 * COMPOUND INDEX FOR ADMIN-SCOPED ACCOUNT-WIDE SESSION QUERIES
 */
// <== COMPOUND INDEX FOR ACCOUNT AND ACTIVE STATUS ==>
sessionSchema.index({ accountId: 1, isActive: 1 });
/**
 * TTL INDEX — MONGODB AUTOMATICALLY DELETES EXPIRED SESSION DOCUMENTS
 */
// <== TTL INDEX FOR AUTO-EXPIRY ==>
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// <== EXPORTING THE SESSION MODEL ==>
export const Session = mongoose.model("Session", sessionSchema);
