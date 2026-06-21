// <== IMPORTS ==>
import mongoose from "mongoose";

// <== USER ROLE CONSTANTS ==>
export const USER_ROLES = {
  // <== ROOT OWNER OF AN ACCOUNT — FULL UNRESTRICTED ACCESS ==>
  SUPERADMIN: "superadmin",
  // <== SAME ACCESS AS SUPERADMIN EXCEPT CANNOT MANAGE ADMINS OR DELETE THE SUPERADMIN ==>
  ADMIN: "admin",
  // <== RESTRICTED ACCESS GOVERNED BY THE PER-MODULE PERMISSIONS MATRIX ==>
  USER: "user",
};

// <== PERMISSION LEVEL CONSTANTS (ORDINAL — EACH LEVEL IMPLIES EVERYTHING BELOW IT) ==>
export const PERMISSION_LEVELS = {
  NONE: "none",
  READ: "read",
  WRITE: "write",
  UPDATE: "update",
};

// <== SHARED PERMISSION LEVEL FIELD CONFIG (REUSED ACROSS ALL MODULE FIELDS BELOW) ==>
const permissionLevelField = {
  type: String,
  enum: Object.values(PERMISSION_LEVELS),
  default: PERMISSION_LEVELS.NONE,
};

// <== MODULE PERMISSIONS SUB-SCHEMA ==>
const modulePermissionsSchema = new mongoose.Schema(
  {
    sales: permissionLevelField,
    purchases: permissionLevelField,
    customers: permissionLevelField,
    expenditures: permissionLevelField,
    recoveries: permissionLevelField,
    quickSales: permissionLevelField,
    dashboard: permissionLevelField,
    analytics: permissionLevelField,
  },
  { _id: false },
);

// <== USER SCHEMA ==>
const userSchema = new mongoose.Schema(
  {
    // ACCOUNT REFERENCE FIELD — THE TENANT THIS USER BELONGS TO
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    // ROLE FIELD — DETERMINES ACCESS TIER
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
    },
    // MODULE PERMISSIONS FIELD — ONLY APPLICABLE FOR USERS WITH ROLE 'USER', IGNORED FOR ADMINS AND SUPERADMINS
    permissions: {
      type: modulePermissionsSchema,
      default: undefined,
    },
    // CREATED BY FIELD — THE SUPERADMIN/ADMIN WHO CREATED THIS USER (NULL FOR THE ROOT SUPERADMIN)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // ACTIVE STATUS FIELD — DEACTIVATED USERS CANNOT LOGIN OR REFRESH THEIR SESSION
    isActive: {
      type: Boolean,
      default: true,
    },
    // TOKEN VERSION FIELD — INCREMENTING THIS IMMEDIATELY INVALIDATES ALL OUTSTANDING REFRESH TOKENS
    tokenVersion: {
      type: Number,
      default: 0,
    },
    // HAS SET PASSWORD FIELD — FALSE FOR INVITED USERS UNTIL THEY COMPLETE ACCOUNT SETUP
    hasSetPassword: {
      type: Boolean,
      default: true,
    },
    // FULL NAME FIELD
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // EMAIL FIELD
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please Provide a Valid email Address!"],
    },
    // PASSWORD FIELD
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    // PHONE NUMBER FIELD
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
      match: [
        /^\+[1-9]\d{1,14}$/,
        "Please Provide a Valid Phone Number with Country Code!",
      ],
    },
    // ADDRESS FIELD (OPTIONAL)
    address: {
      type: String,
      default: null,
      trim: true,
      maxlength: [300, "Address must not exceed 300 Characters!"],
    },
    // AVATAR FIELD (OPTIONAL — CLOUDINARY STORED)
    avatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    // MILK RATE FIELD (PRICE PER LITER IN RUPEES)
    milkRate: {
      type: Number,
      default: 120,
      min: [1, "Milk Rate must be at least ₨1!"],
    },
    // YOGHURT RATE FIELD (PRICE PER KG IN RUPEES)
    yoghurtRate: {
      type: Number,
      default: 180,
      min: [1, "Yoghurt Rate must be at least ₨1!"],
    },
    // DAILY REPORTS ENABLED FLAG
    dailyReportsEnabled: {
      type: Boolean,
      default: false,
    },
    // MONTHLY REPORTS ENABLED FLAG
    monthlyReportsEnabled: {
      type: Boolean,
      default: false,
    },
    // LAST DAILY REPORT SENT DATE (YYYY-MM-DD) — IDEMPOTENCY GUARD FOR DAILY CRON
    lastDailyReportSentDate: {
      type: String,
      default: null,
      match: [
        /^\d{4}-\d{2}-\d{2}$/,
        "Last Daily Report Sent Date must be in YYYY-MM-DD Format!",
      ],
    },
    // LAST MONTHLY REPORT SENT MONTH (YYYY-MM) — IDEMPOTENCY GUARD FOR MONTHLY CRON
    lastMonthlyReportSentDate: {
      type: String,
      default: null,
      match: [
        /^\d{4}-\d{2}$/,
        "Last Monthly Report Sent Date must be in YYYY-MM Format!",
      ],
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * TEXT INDEX FOR SEARCH FUNCTIONALITY
 */
// <== TEXT INDEX FOR SEARCH FUNCTIONALITY ==>
userSchema.index({
  fullName: "text",
  email: "text",
});
/**
 * COMPOUND INDEX FOR EMAIL AND FULL NAME SEARCHES
 */
// <== COMPOUND INDEX FOR EMAIL AND FULL NAME SEARCHES ==>
userSchema.index({ email: 1, fullName: 1 });
/**
 * INDEX FOR PHONE NUMBER
 */
// <== INDEX FOR PHONE NUMBER ==>
userSchema.index({ phoneNumber: 1 }, { sparse: true });
/**
 * COMPOUND INDEX FOR LISTING USERS UNDER AN ACCOUNT BY ROLE
 */
// <== COMPOUND INDEX FOR ACCOUNT AND ROLE LOOKUPS ==>
userSchema.index({ accountId: 1, role: 1 });

// <== EXPORTING THE USER MODEL ==>
export const User = mongoose.model("User", userSchema);
