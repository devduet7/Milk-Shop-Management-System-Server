// <== IMPORTS ==>
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== GET EXPENDITURES QUERY VALIDATION RULES ==>
export const validateGetExpenditures = [
  // VALIDATING OPTIONAL FILTER QUERY PARAM
  query("filter")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["today", "week", "month"])
    .withMessage("Filter must be today, week, or month!"),
  // VALIDATING OPTIONAL MONTH QUERY PARAM (USED WHEN FILTER IS MONTH)
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // VALIDATING OPTIONAL CATEGORY FILTER
  query("category")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["supplies", "meals", "transport", "misc"])
    .withMessage("Category must be supplies, meals, transport, or misc!"),
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

// <== ADD EXPENDITURE VALIDATION RULES ==>
export const validateAddExpenditure = [
  // VALIDATING TITLE FIELD
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is Required!")
    .isLength({ min: 2, max: 150 })
    .withMessage("Title must be Between 2 and 150 Characters!"),
  // VALIDATING CATEGORY FIELD
  body("category")
    .notEmpty()
    .withMessage("Category is Required!")
    .isIn(["supplies", "meals", "transport", "misc"])
    .withMessage("Category must be supplies, meals, transport, or misc!"),
  // VALIDATING AMOUNT FIELD
  body("amount")
    .notEmpty()
    .withMessage("Amount is Required!")
    .isFloat({ min: 1 })
    .withMessage("Amount must be at least ₨1!"),
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

// <== UPDATE EXPENDITURE VALIDATION RULES ==>
export const validateUpdateExpenditure = [
  // VALIDATING EXPENDITURE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Expenditure ID is Required!")
    .isMongoId()
    .withMessage("Invalid Expenditure ID!"),
  // VALIDATING OPTIONAL TITLE FIELD
  body("title")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage("Title must be Between 2 and 150 Characters!"),
  // VALIDATING OPTIONAL CATEGORY FIELD
  body("category")
    .optional()
    .isIn(["supplies", "meals", "transport", "misc"])
    .withMessage("Category must be supplies, meals, transport, or misc!"),
  // VALIDATING OPTIONAL AMOUNT FIELD
  body("amount")
    .optional()
    .isFloat({ min: 1 })
    .withMessage("Amount must be at least ₨1!"),
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

// <== DELETE EXPENDITURE VALIDATION RULES ==>
export const validateDeleteExpenditure = [
  // VALIDATING EXPENDITURE ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Expenditure ID is Required!")
    .isMongoId()
    .withMessage("Invalid Expenditure ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
