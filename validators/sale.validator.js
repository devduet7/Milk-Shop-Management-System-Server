// <== IMPORTS ==>
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== GET SALES QUERY VALIDATION RULES ==>
export const validateGetSales = [
  // VALIDATING REQUIRED SALE TYPE QUERY PARAM
  query("saleType")
    .notEmpty()
    .withMessage("Sale Type is Required!")
    .isIn(["customer", "shop"])
    .withMessage("Sale Type must be customer or shop!"),
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
  // VALIDATING OPTIONAL SEARCH QUERY PARAM (CUSTOMER NAME SEARCH)
  query("search")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search Query must not exceed 100 Characters!"),
  // VALIDATING OPTIONAL PENDING ONLY FLAG (CUSTOMER SALES ONLY)
  query("pendingOnly")
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean()
    .withMessage("Pending Only must be true or false!"),
  // VALIDATING OPTIONAL PRODUCT TYPE FILTER (SHOP SALES ONLY)
  query("productType")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["milk", "yoghurt"])
    .withMessage("Product Type must be milk or yoghurt!"),
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

// <== ADD SALE VALIDATION RULES ==>
export const validateAddSale = [
  // VALIDATING SALE TYPE FIELD
  body("saleType")
    .notEmpty()
    .withMessage("Sale Type is Required!")
    .isIn(["customer", "shop"])
    .withMessage("Sale Type must be customer or shop!"),
  // VALIDATING CUSTOMER NAME FIELD (REQUIRED WHEN SALE TYPE IS CUSTOMER)
  body("customerName")
    .if(body("saleType").equals("customer"))
    .trim()
    .notEmpty()
    .withMessage("Customer Name is Required for Customer Sales!")
    .isLength({ min: 2, max: 150 })
    .withMessage("Customer Name must be Between 2 and 150 Characters!"),
  // VALIDATING PRODUCT TYPE FIELD
  body("productType")
    .notEmpty()
    .withMessage("Product Type is Required!")
    .isIn(["milk", "yoghurt"])
    .withMessage("Product Type must be milk or yoghurt!"),
  // VALIDATING QUANTITY FIELD
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is Required!")
    .isFloat({ min: 0.1 })
    .withMessage("Quantity must be at least 0.1!"),
  // VALIDATING PRICE PER UNIT FIELD
  body("pricePerUnit")
    .notEmpty()
    .withMessage("Price per Unit is Required!")
    .isFloat({ min: 1 })
    .withMessage("Price per Unit must be at least ₨1!"),
  // VALIDATING OPTIONAL DISCOUNT FIELD
  body("discount")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage("Discount must be at least ₨0!"),
  // VALIDATING OPTIONAL PAID AMOUNT FIELD
  body("paidAmount")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Paid Amount must be at least ₨0!"),
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

// <== UPDATE SALE VALIDATION RULES ==>
export const validateUpdateSale = [
  // VALIDATING SALE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Sale ID is Required!")
    .isMongoId()
    .withMessage("Invalid Sale ID!"),
  // VALIDATING OPTIONAL CUSTOMER NAME FIELD
  body("customerName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage("Customer Name must be Between 2 and 150 Characters!"),
  // VALIDATING OPTIONAL PRODUCT TYPE FIELD
  body("productType")
    .optional()
    .isIn(["milk", "yoghurt"])
    .withMessage("Product Type must be milk or yoghurt!"),
  // VALIDATING OPTIONAL QUANTITY FIELD
  body("quantity")
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage("Quantity must be at least 0.1!"),
  // VALIDATING OPTIONAL PRICE PER UNIT FIELD
  body("pricePerUnit")
    .optional()
    .isFloat({ min: 1 })
    .withMessage("Price per Unit must be at least ₨1!"),
  // VALIDATING OPTIONAL DISCOUNT FIELD
  body("discount")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage("Discount must be at least ₨0!"),
  // VALIDATING OPTIONAL PAID AMOUNT FIELD
  body("paidAmount")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Paid Amount must be at least ₨0!"),
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

// <== DELETE SALE VALIDATION RULES ==>
export const validateDeleteSale = [
  // VALIDATING SALE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Sale ID is Required!")
    .isMongoId()
    .withMessage("Invalid Sale ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
