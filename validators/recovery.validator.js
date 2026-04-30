// <== IMPORTS ==>
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== GET RECOVERIES QUERY VALIDATION RULES ==>
export const validateGetRecoveries = [
  // VALIDATING REQUIRED TAB QUERY PARAM
  query("tab")
    .notEmpty()
    .withMessage("Tab is Required!")
    .isIn(["deliveries", "sales"])
    .withMessage("Tab must be deliveries or sales!"),
  // VALIDATING OPTIONAL FILTER QUERY PARAM
  query("filter")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["today", "week", "month"])
    .withMessage("Filter must be today, week, or month!"),
  // VALIDATING OPTIONAL MONTH QUERY PARAM
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // VALIDATING OPTIONAL STATUS FILTER
  query("status")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["all", "pending", "cleared"])
    .withMessage("Status must be all, pending, or cleared!"),
  // VALIDATING OPTIONAL SEARCH QUERY PARAM
  query("search")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search Query must not exceed 100 Characters!"),
  // VALIDATING OPTIONAL PAGE QUERY PARAM
  query("page")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("Page must be a Positive Integer!"),
  // VALIDATING OPTIONAL LIMIT QUERY PARAM
  query("limit")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be Between 1 and 100!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== ADD DELIVERY PAYMENT VALIDATION RULES ==>
export const validateAddDeliveryPayment = [
  // VALIDATING CUSTOMER ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Customer ID is Required!")
    .isMongoId()
    .withMessage("Invalid Customer ID!"),
  // VALIDATING AMOUNT FIELD
  body("amount")
    .notEmpty()
    .withMessage("Payment Amount is Required!")
    .isFloat({ min: 1 })
    .withMessage("Payment Amount must be at least ₨1!"),
  // VALIDATING BILLING MONTH FIELD
  body("billingMonth")
    .notEmpty()
    .withMessage("Billing Month is Required!")
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Billing Month must be in YYYY-MM Format!"),
  // VALIDATING OPTIONAL PAYMENT DATE FIELD
  body("paymentDate")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Payment Date must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL NOTE FIELD
  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Note must not exceed 300 Characters!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== UPDATE SALE PAYMENT VALIDATION RULES ==>
export const validateUpdateSalePayment = [
  // VALIDATING SALE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Sale ID is Required!")
    .isMongoId()
    .withMessage("Invalid Sale ID!"),
  // VALIDATING PAID AMOUNT FIELD
  body("paidAmount")
    .notEmpty()
    .withMessage("Paid Amount is Required!")
    .isFloat({ min: 0 })
    .withMessage("Paid Amount must be at least ₨0!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== DELETE SALE RECORD VALIDATION RULES ==>
export const validateDeleteSaleRecord = [
  // VALIDATING SALE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Sale ID is Required!")
    .isMongoId()
    .withMessage("Invalid Sale ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
