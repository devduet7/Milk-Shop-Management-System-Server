// <== IMPORTS ==>
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== GET STAFF QUERY VALIDATION RULES ==>
export const validateGetStaff = [
  // VALIDATING OPTIONAL MONTH QUERY PARAM
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
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

// <== ADD STAFF VALIDATION RULES ==>
export const validateAddStaff = [
  // VALIDATING NAME FIELD
  body("name")
    .notEmpty()
    .withMessage("Staff Name is Required!")
    .trim()
    .isLength({ max: 100 })
    .withMessage("Staff Name must not exceed 100 Characters!"),
  // VALIDATING MONTHLY SALARY FIELD
  body("monthlySalary")
    .notEmpty()
    .withMessage("Monthly Salary is Required!")
    .isFloat({ min: 1 })
    .withMessage("Monthly Salary must be at least ₨1!"),
  // VALIDATING OPTIONAL NOTE FIELD
  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Note must not exceed 300 Characters!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== UPDATE STAFF VALIDATION RULES ==>
export const validateUpdateStaff = [
  // VALIDATING STAFF ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Staff ID is Required!")
    .isMongoId()
    .withMessage("Invalid Staff ID!"),
  // VALIDATING OPTIONAL NAME FIELD
  body("name")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Staff Name must not exceed 100 Characters!"),
  // VALIDATING OPTIONAL MONTHLY SALARY FIELD
  body("monthlySalary")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 1 })
    .withMessage("Monthly Salary must be at least ₨1!"),
  // VALIDATING OPTIONAL NOTE FIELD
  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Note must not exceed 300 Characters!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== DELETE STAFF VALIDATION RULES ==>
export const validateDeleteStaff = [
  // VALIDATING STAFF ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Staff ID is Required!")
    .isMongoId()
    .withMessage("Invalid Staff ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== PAY SALARY VALIDATION RULES ==>
export const validatePaySalary = [
  // VALIDATING STAFF ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Staff ID is Required!")
    .isMongoId()
    .withMessage("Invalid Staff ID!"),
  // VALIDATING MONTH FIELD
  body("month")
    .notEmpty()
    .withMessage("Billing Month is Required!")
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // VALIDATING AMOUNT FIELD
  body("amount")
    .notEmpty()
    .withMessage("Payment Amount is Required!")
    .isFloat({ min: 1 })
    .withMessage("Payment Amount must be at least ₨1!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== ADD EXTRA ALLOCATION VALIDATION RULES ==>
export const validateAddExtraAllocation = [
  // VALIDATING STAFF ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Staff ID is Required!")
    .isMongoId()
    .withMessage("Invalid Staff ID!"),
  // VALIDATING MONTH FIELD
  body("month")
    .notEmpty()
    .withMessage("Billing Month is Required!")
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // VALIDATING AMOUNT FIELD
  body("amount")
    .notEmpty()
    .withMessage("Amount is Required!")
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

// <== GET EXTRA ALLOCATIONS VALIDATION RULES ==>
export const validateGetExtraAllocations = [
  // VALIDATING STAFF ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Staff ID is Required!")
    .isMongoId()
    .withMessage("Invalid Staff ID!"),
  // VALIDATING OPTIONAL MONTH QUERY PARAM
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
