// <== IMPORTS ==>
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== GET QUICK SALES QUERY VALIDATION RULES ==>
export const validateGetQuickSales = [
  // VALIDATING OPTIONAL FILTER TYPE
  query("filterType")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["today", "week", "month", "date", "range"])
    .withMessage("Filter Type must be today, week, month, date, or range!"),
  // VALIDATING OPTIONAL DATE FOR DATE FILTER
  query("date")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL MONTH FOR MONTH FILTER
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // VALIDATING OPTIONAL RANGE START FOR THE RANGE FILTER
  query("rangeStart")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Range Start must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL RANGE END FOR THE RANGE FILTER
  query("rangeEnd")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Range End must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL PRODUCT TYPE FILTER
  query("productType")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["all", "milk", "yoghurt"])
    .withMessage("Product Type must be all, milk, or yoghurt!"),
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

// <== ADD QUICK SALE VALIDATION RULES ==>
export const validateAddQuickSale = [
  // VALIDATING TYPE FIELD
  body("type")
    .notEmpty()
    .withMessage("Sale Type is Required!")
    .isIn(["milk", "yoghurt"])
    .withMessage("Sale Type must be milk or yoghurt!"),
  // VALIDATING QUANTITY FIELD
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is Required!")
    .isFloat({ min: 0.1 })
    .withMessage("Quantity must be at least 0.1!"),
  // VALIDATING RATE FIELD
  body("rate")
    .notEmpty()
    .withMessage("Rate is Required!")
    .isFloat({ min: 1 })
    .withMessage("Rate must be at least ₨1!"),
  // VALIDATING OPTIONAL DATE FIELD
  body("date")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL NOTE FIELD
  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Note must not exceed 300 Characters!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== UPDATE QUICK SALE VALIDATION RULES ==>
export const validateUpdateQuickSale = [
  // VALIDATING QUICK SALE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Quick Sale ID is Required!")
    .isMongoId()
    .withMessage("Invalid Quick Sale ID!"),
  // VALIDATING OPTIONAL TYPE FIELD
  body("type")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["milk", "yoghurt"])
    .withMessage("Sale Type must be milk or yoghurt!"),
  // VALIDATING OPTIONAL QUANTITY FIELD
  body("quantity")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0.1 })
    .withMessage("Quantity must be at least 0.1!"),
  // VALIDATING OPTIONAL RATE FIELD
  body("rate")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 1 })
    .withMessage("Rate must be at least ₨1!"),
  // VALIDATING OPTIONAL DATE FIELD
  body("date")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL NOTE FIELD
  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Note must not exceed 300 Characters!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== DELETE QUICK SALE VALIDATION RULES ==>
export const validateDeleteQuickSale = [
  // VALIDATING QUICK SALE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Quick Sale ID is Required!")
    .isMongoId()
    .withMessage("Invalid Quick Sale ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
