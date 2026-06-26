// <== IMPORTS ==>
import { handleValidationErrors } from "./user.validator.js";
import { body, param, query, validationResult } from "express-validator";

// <== VALID MODULE KEYS FOR PERMISSION MATRIX ==>
const MODULE_KEYS = [
  "sales",
  "purchases",
  "customers",
  "expenditures",
  "recoveries",
  "quickSales",
  "dashboard",
  "analytics",
];

// <== VALID PERMISSION LEVELS ==>
const PERMISSION_LEVEL_VALUES = ["none", "read", "write", "update"];

// <== LIST USERS VALIDATION RULES ==>
export const validateListUsers = [
  // VALIDATING OPTIONAL ROLE FILTER
  query("role")
    .optional()
    .isIn(["superadmin", "admin", "user"])
    .withMessage("Role filter must be superadmin, admin, or user!"),
  // VALIDATING OPTIONAL SEARCH QUERY
  query("search")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Search must not exceed 100 Characters!"),
  // VALIDATING OPTIONAL PAGE PARAM
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a Positive Integer!"),
  // VALIDATING OPTIONAL LIMIT PARAM
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be Between 1 and 100!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== INVITE USER VALIDATION RULES ==>
export const validateInviteUser = [
  // VALIDATING FULL NAME FIELD
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full Name is Required!")
    .isLength({ min: 2, max: 50 })
    .withMessage("Full Name must be Between 2 and 50 Characters!"),
  // VALIDATING EMAIL FIELD
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is Required!")
    .isEmail()
    .withMessage("Please Provide a Valid Email Address!")
    .normalizeEmail(),
  // VALIDATING ROLE FIELD — SUPERADMIN CANNOT BE INVITED, MUST BE BOOTSTRAPPED VIA SCRIPT
  body("role")
    .notEmpty()
    .withMessage("Role is Required!")
    .isIn(["admin", "user"])
    .withMessage("Role must be admin or user!"),
  // VALIDATING PERMISSIONS OBJECT — REQUIRED ONLY FOR USER-TIER INVITES
  body("permissions")
    .if(body("role").equals("user"))
    .notEmpty()
    .withMessage("Permissions are Required for User-Tier Accounts!")
    .isObject()
    .withMessage("Permissions must be a Valid Object!"),
  // VALIDATING EACH MODULE PERMISSION FIELD — ONLY FOR USER-TIER INVITES
  ...MODULE_KEYS.map((module) =>
    body(`permissions.${module}`)
      .if(body("role").equals("user"))
      .notEmpty()
      .withMessage(`${module} permission is Required for User-Tier Accounts!`)
      .isIn(PERMISSION_LEVEL_VALUES)
      .withMessage(
        `${module} permission must be one of: none, read, write, update!`,
      ),
  ),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== RESEND INVITE VALIDATION RULES ==>
export const validateResendInvite = [
  // VALIDATING ID PARAM AS VALID MONGOID
  param("id").isMongoId().withMessage("Invalid User ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== COMPLETE ACCOUNT SETUP VALIDATION RULES ==>
export const validateCompleteSetup = [
  // VALIDATING EMAIL FIELD
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is Required!")
    .isEmail()
    .withMessage("Please Provide a Valid Email Address!")
    .normalizeEmail(),
  // VALIDATING OTP CODE — MUST BE EXACTLY 6 DIGITS
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Setup Code is Required!")
    .isLength({ min: 6, max: 6 })
    .withMessage("Setup Code must be Exactly 6 Digits!")
    .isNumeric()
    .withMessage("Setup Code must Contain Only Digits!"),
  // VALIDATING NEW PASSWORD WITH SAME STRENGTH RULES AS THE REST OF THE SYSTEM
  body("newPassword")
    .notEmpty()
    .withMessage("Password is Required!")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 Characters Long!")
    .matches(/[A-Z]/)
    .withMessage("Password must Contain at least One Uppercase Letter!")
    .matches(/[a-z]/)
    .withMessage("Password must Contain at least One Lowercase Letter!")
    .matches(/[0-9]/)
    .withMessage("Password must Contain at least One Digit!")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must Contain at least One Special Character!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== UPDATE USER PERMISSIONS VALIDATION RULES ==>
export const validateUpdatePermissions = [
  // VALIDATING ID PARAM AS VALID MONGOID
  param("id").isMongoId().withMessage("Invalid User ID!"),
  // VALIDATING PERMISSIONS OBJECT IS PRESENT
  body("permissions")
    .notEmpty()
    .withMessage("Permissions are Required!")
    .isObject()
    .withMessage("Permissions must be a Valid Object!"),
  // VALIDATING EACH MODULE PERMISSION FIELD
  ...MODULE_KEYS.map((module) =>
    body(`permissions.${module}`)
      .notEmpty()
      .withMessage(`${module} permission is Required!`)
      .isIn(PERMISSION_LEVEL_VALUES)
      .withMessage(
        `${module} permission must be one of: none, read, write, update!`,
      ),
  ),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== UPDATE USER STATUS VALIDATION RULES ==>
export const validateUpdateStatus = [
  // VALIDATING ID PARAM AS VALID MONGOID
  param("id").isMongoId().withMessage("Invalid User ID!"),
  // VALIDATING ISACTIVE FIELD AS BOOLEAN
  body("isActive")
    .notEmpty()
    .withMessage("isActive is Required!")
    .isBoolean()
    .withMessage("isActive must be true or false!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== DELETE USER VALIDATION RULES ==>
export const validateDeleteUser = [
  // VALIDATING ID PARAM AS VALID MONGOID
  param("id").isMongoId().withMessage("Invalid User ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
