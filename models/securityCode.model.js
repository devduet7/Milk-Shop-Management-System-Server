// <== IMPORTS ==>
import mongoose from "mongoose";

// <== SECURITY CODE PURPOSE CONSTANTS ==>
export const SECURITY_CODE_PURPOSES = {
  // <== STEP 1 OF EMAIL CHANGE — SENT TO CURRENT EMAIL FOR IDENTITY VERIFICATION ==>
  EMAIL_CHANGE_CURRENT: "email_change_current",
  // <== STEP 2 OF EMAIL CHANGE — SENT TO NEW EMAIL TO CONFIRM OWNERSHIP ==>
  EMAIL_CHANGE_NEW: "email_change_new",
  // <== SENT TO CURRENT EMAIL BEFORE UPDATING PHONE NUMBER ==>
  PHONE_CHANGE: "phone_change",
  // <== SENT TO CURRENT EMAIL BEFORE APPLYING NEW PASSWORD ==>
  PASSWORD_CHANGE: "password_change",
  // <== SENT TO CURRENT EMAIL FOR PASSWORD RESET ==>
  FORGOT_PASSWORD_OTP: "forgot_password_otp",
  // <== SENT TO CURRENT EMAIL FOR PASSWORD RESET ==>
  FORGOT_PASSWORD_RESET: "forgot_password_reset",
  // <== SENT TO INVITED USER'S EMAIL TO COMPLETE ACCOUNT SETUP ==>
  ACCOUNT_INVITE: "account_invite",
};

// <== SECURITY CODE SCHEMA ==>
const securityCodeSchema = new mongoose.Schema(
  {
    // USER ID FIELD — LINKS CODE TO REQUESTING USER
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // BCRYPT HASHED OTP CODE — NEVER STORED IN PLAINTEXT
    hashedCode: {
      type: String,
      required: true,
      select: false,
    },
    // PURPOSE — IDENTIFIES WHICH CHANGE FLOW THIS CODE BELONGS TO
    purpose: {
      type: String,
      enum: Object.values(SECURITY_CODE_PURPOSES),
      required: true,
    },
    // PENDING VALUE — NEW EMAIL, NEW PHONE, OR PRE-HASHED NEW PASSWORD
    pendingValue: {
      type: String,
      default: null,
    },
    // EXPIRY TIMESTAMP — CODE IS INVALID AFTER THIS DATE
    expiresAt: {
      type: Date,
      required: true,
    },
    // FAILED ATTEMPT COUNTER — CODE IS LOCKED AFTER 5 FAILED ATTEMPTS
    attempts: {
      type: Number,
      default: 0,
    },
    // USED FLAG — PREVENTS REPLAY ATTACKS AFTER SUCCESSFUL VERIFICATION
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * TTL INDEX — MONGODB AUTOMATICALLY DELETES EXPIRED CODE DOCUMENTS
 */
// <== TTL INDEX FOR AUTO-EXPIRY ==>
securityCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
/**
 * COMPOUND INDEX FOR FAST LOOKUP BY USER AND PURPOSE
 */
// <== COMPOUND INDEX FOR USER AND PURPOSE LOOKUP ==>
securityCodeSchema.index({ userId: 1, purpose: 1 });

// <== EXPORTING THE SECURITY CODE MODEL ==>
export const SecurityCode = mongoose.model("SecurityCode", securityCodeSchema);
