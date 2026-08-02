// <== IMPORTS ==>
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== GET PURCHASES QUERY VALIDATION RULES ==>
export const validateGetPurchases = [
  // VALIDATING OPTIONAL FILTER QUERY PARAM
  query("filter")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["today", "week", "month", "date", "range"])
    .withMessage("Filter must be today, week, month, date, or range!"),
  // VALIDATING OPTIONAL MONTH QUERY PARAM (USED WHEN FILTER IS MONTH)
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // VALIDATING OPTIONAL DATE QUERY PARAM (USED WHEN FILTER IS DATE)
  query("date")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL RANGE START QUERY PARAM (USED WHEN FILTER IS RANGE)
  query("rangeStart")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Range Start must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL RANGE END QUERY PARAM (USED WHEN FILTER IS RANGE)
  query("rangeEnd")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Range End must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL SEARCH QUERY PARAM (SEARCHES BY SUPPLIER NAME)
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

// <== ADD PURCHASE VALIDATION RULES ==>
export const validateAddPurchase = [
  // VALIDATING SUPPLIER NAME FIELD
  body("supplier")
    .trim()
    .notEmpty()
    .withMessage("Supplier Name is Required!")
    .isLength({ min: 2, max: 150 })
    .withMessage("Supplier Name must be Between 2 and 150 Characters!"),
  // VALIDATING MILK QUANTITY FIELD
  body("milkQuantity")
    .notEmpty()
    .withMessage("Milk Quantity is Required!")
    .isFloat({ min: 0.5 })
    .withMessage("Milk Quantity must be at least 0.5 Liters!"),
  // VALIDATING TOTAL COST FIELD
  body("totalCost")
    .notEmpty()
    .withMessage("Total Cost is Required!")
    .isFloat({ min: 1 })
    .withMessage("Total Cost must be at least ₨1!"),
  // VALIDATING OPTIONAL DATE FIELD (DEFAULTS TO TODAY ON BACKEND IF OMITTED)
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

// <== UPDATE PURCHASE VALIDATION RULES ==>
export const validateUpdatePurchase = [
  // VALIDATING PURCHASE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Purchase ID is Required!")
    .isMongoId()
    .withMessage("Invalid Purchase ID!"),
  // VALIDATING OPTIONAL SUPPLIER NAME FIELD
  body("supplier")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage("Supplier Name must be Between 2 and 150 Characters!"),
  // VALIDATING OPTIONAL MILK QUANTITY FIELD
  body("milkQuantity")
    .optional()
    .isFloat({ min: 0.5 })
    .withMessage("Milk Quantity must be at least 0.5 Liters!"),
  // VALIDATING OPTIONAL TOTAL COST FIELD
  body("totalCost")
    .optional()
    .isFloat({ min: 1 })
    .withMessage("Total Cost must be at least ₨1!"),
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

// <== DELETE PURCHASE VALIDATION RULES ==>
export const validateDeletePurchase = [
  // VALIDATING PURCHASE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Purchase ID is Required!")
    .isMongoId()
    .withMessage("Invalid Purchase ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
