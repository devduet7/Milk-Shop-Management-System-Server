// <== IMPORTS ==>
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== GET MILK LOGS QUERY VALIDATION RULES ==>
export const validateGetMilkLogs = [
  // VALIDATING OPTIONAL FILTER TYPE
  query("filterType")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["today", "week", "month", "date", "range"])
    .withMessage("Filter Type must be today, week, month, date, or range!"),
  // VALIDATING OPTIONAL DATE FOR THE DATE FILTER
  query("date")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD Format!"),
  // VALIDATING OPTIONAL MONTH FOR THE MONTH FILTER
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
  // VALIDATING OPTIONAL ENTRY TYPE FILTER
  query("type")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["all", "leftover", "yoghurt"])
    .withMessage("Type must be all, leftover, or yoghurt!"),
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

// <== ADD MILK LOG VALIDATION RULES ==>
export const validateAddMilkLog = [
  // VALIDATING TYPE FIELD
  body("type")
    .notEmpty()
    .withMessage("Entry Type is Required!")
    .isIn(["leftover", "yoghurt"])
    .withMessage("Entry Type must be leftover or yoghurt!"),
  // VALIDATING QUANTITY FIELD — ZERO IS A VALID VALUE
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is Required!")
    .isFloat({ min: 0 })
    .withMessage("Quantity cannot be Negative!"),
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

// <== UPDATE MILK LOG VALIDATION RULES ==>
export const validateUpdateMilkLog = [
  // VALIDATING MILK LOG ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Milk Log ID is Required!")
    .isMongoId()
    .withMessage("Invalid Milk Log ID!"),
  // VALIDATING OPTIONAL TYPE FIELD
  body("type")
    .optional()
    .isIn(["leftover", "yoghurt"])
    .withMessage("Entry Type must be leftover or yoghurt!"),
  // VALIDATING OPTIONAL QUANTITY FIELD
  body("quantity")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Quantity cannot be Negative!"),
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

// <== DELETE MILK LOG VALIDATION RULES ==>
export const validateDeleteMilkLog = [
  // VALIDATING MILK LOG ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Milk Log ID is Required!")
    .isMongoId()
    .withMessage("Invalid Milk Log ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
