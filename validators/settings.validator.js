// <== IMPORTS ==>
import {
  DELETION_MODES,
  TRASH_RETENTION_OPTIONS,
} from "../models/account.model.js";
import { body, param } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";
import { SECURITY_CODE_PURPOSES } from "../models/securityCode.model.js";

// <== UPDATE FULL NAME VALIDATION ==>
export const validateUpdateFullName = [
  // VALIDATING FULL NAME FIELD
  body("fullName")
    .notEmpty()
    .withMessage("Full Name is Required!")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Full Name must be Between 2 and 50 Characters!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== UPDATE ADDRESS VALIDATION ==>
export const validateUpdateAddress = [
  // VALIDATING OPTIONAL ADDRESS FIELD
  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Address must not exceed 300 Characters!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== INITIATE PHONE CHANGE VALIDATION ==>
export const validateInitiatePhoneChange = [
  // VALIDATING NEW PHONE NUMBER FIELD
  body("newPhone")
    .notEmpty()
    .withMessage("New Phone Number is Required!")
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage(
      "Please Provide a Valid Phone Number with Country Code (e.g., +923001234567)!",
    ),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VERIFY OTP CODE VALIDATION ==>
export const validateVerifyCode = [
  // VALIDATING 6-DIGIT NUMERIC OTP CODE
  body("code")
    .notEmpty()
    .withMessage("Verification Code is Required!")
    .isLength({ min: 6, max: 6 })
    .withMessage("Verification Code must be Exactly 6 Digits!")
    .isNumeric()
    .withMessage("Verification Code must Contain Only Digits!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== INITIATE EMAIL CHANGE VALIDATION ==>
export const validateInitiateEmailChange = [
  // VALIDATING NEW EMAIL FIELD
  body("newEmail")
    .notEmpty()
    .withMessage("New Email Address is Required!")
    .isEmail()
    .withMessage("Please Provide a Valid Email Address!")
    .normalizeEmail(),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== INITIATE PASSWORD CHANGE VALIDATION ==>
export const validateInitiatePasswordChange = [
  // VALIDATING NEW PASSWORD FIELD WITH FULL STRENGTH REQUIREMENTS
  body("newPassword")
    .notEmpty()
    .withMessage("New Password is Required!")
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

// <== UPDATE PRICING VALIDATION ==>
export const validateUpdatePricing = [
  // VALIDATING OPTIONAL MILK RATE
  body("milkRate")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 1 })
    .withMessage("Milk Rate must be at least ₨1!"),
  // VALIDATING OPTIONAL YOGHURT RATE
  body("yoghurtRate")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 1 })
    .withMessage("Yoghurt Rate must be at least ₨1!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== UPDATE REPORT SETTINGS VALIDATION ==>
export const validateUpdateReportSettings = [
  // VALIDATING OPTIONAL DAILY REPORTS FLAG
  body("dailyReportsEnabled")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("Daily Reports Enabled must be a Boolean!"),
  // VALIDATING OPTIONAL MONTHLY REPORTS FLAG
  body("monthlyReportsEnabled")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("Monthly Reports Enabled must be a Boolean!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== UPDATE TRASH SETTINGS VALIDATION ==>
export const validateUpdateTrashSettings = [
  // VALIDATING OPTIONAL DELETION MODE
  body("deletionMode")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(Object.values(DELETION_MODES))
    .withMessage("Deletion Mode must be either 'instant' or 'trash'!"),
  // VALIDATING OPTIONAL TRASH RETENTION DAYS
  body("trashRetentionDays")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(TRASH_RETENTION_OPTIONS)
    .withMessage("Trash Retention Days must be 7, 15, or 30!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== CANCEL SECURITY CODE VALIDATION ==>
export const validateCancelSecurityCode = [
  // VALIDATING PURPOSE PARAM AGAINST KNOWN PURPOSES
  param("purpose")
    .notEmpty()
    .withMessage("Purpose is Required!")
    .isIn(Object.values(SECURITY_CODE_PURPOSES))
    .withMessage("Invalid Purpose!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== INITIATE FORGOT PASSWORD VALIDATION ==>
export const validateInitiateForgotPassword = [
  // VALIDATING EMAIL FIELD
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email Address is Required!")
    .isEmail()
    .withMessage("Please Provide a Valid Email Address!")
    .normalizeEmail(),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VERIFY FORGOT PASSWORD OTP VALIDATION ==>
export const validateVerifyForgotPasswordOtp = [
  // VALIDATING EMAIL FIELD
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email Address is Required!")
    .isEmail()
    .withMessage("Please Provide a Valid Email Address!")
    .normalizeEmail(),
  // VALIDATING 6-DIGIT OTP CODE
  body("code")
    .notEmpty()
    .withMessage("Verification Code is Required!")
    .isLength({ min: 6, max: 6 })
    .withMessage("Verification Code must be Exactly 6 Digits!")
    .isNumeric()
    .withMessage("Verification Code must Contain Only Digits!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== RESET FORGOT PASSWORD VALIDATION ==>
export const validateResetForgotPassword = [
  // VALIDATING EMAIL FIELD
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email Address is Required!")
    .isEmail()
    .withMessage("Please Provide a Valid Email Address!")
    .normalizeEmail(),
  // VALIDATING NEW PASSWORD FIELD WITH FULL STRENGTH REQUIREMENTS
  body("newPassword")
    .notEmpty()
    .withMessage("New Password is Required!")
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

// <== CANCEL FORGOT PASSWORD VALIDATION ==>
export const validateCancelForgotPassword = [
  // VALIDATING EMAIL FIELD — NEEDED TO IDENTIFY WHICH USER'S CODES TO CLEAN UP
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email Address is Required!")
    .isEmail()
    .withMessage("Please Provide a Valid Email Address!")
    .normalizeEmail(),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
