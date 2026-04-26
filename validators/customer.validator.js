// <== IMPORTS ==>
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== GET CUSTOMERS QUERY VALIDATION RULES ==>
export const validateGetCustomers = [
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

// <== GET CUSTOMER DETAIL VALIDATION RULES ==>
export const validateGetCustomerDetail = [
  // VALIDATING CUSTOMER ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Customer ID is Required!")
    .isMongoId()
    .withMessage("Invalid Customer ID!"),
  // VALIDATING OPTIONAL MONTH QUERY PARAM
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== ADD CUSTOMER VALIDATION RULES ==>
export const validateAddCustomer = [
  // VALIDATING NAME FIELD
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Customer Name is Required!")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be Between 2 and 100 Characters!"),
  // VALIDATING OPTIONAL PHONE FIELD
  body("phone")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone must not exceed 20 Characters!"),
  // VALIDATING OPTIONAL ADDRESS FIELD
  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 200 })
    .withMessage("Address must not exceed 200 Characters!"),
  // VALIDATING DAILY MILK FIELD
  body("dailyMilk")
    .notEmpty()
    .withMessage("Daily Milk is Required!")
    .isFloat({ min: 0.5 })
    .withMessage("Daily Milk must be at least 0.5 Liters!"),
  // VALIDATING PRICE PER LITER FIELD
  body("pricePerLiter")
    .notEmpty()
    .withMessage("Price per Liter is Required!")
    .isFloat({ min: 1 })
    .withMessage("Price per Liter must be at least ₨1!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== UPDATE CUSTOMER VALIDATION RULES ==>
export const validateUpdateCustomer = [
  // VALIDATING CUSTOMER ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Customer ID is Required!")
    .isMongoId()
    .withMessage("Invalid Customer ID!"),
  // VALIDATING OPTIONAL NAME FIELD
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be Between 2 and 100 Characters!"),
  // VALIDATING OPTIONAL PHONE FIELD
  body("phone")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone must not exceed 20 Characters!"),
  // VALIDATING OPTIONAL ADDRESS FIELD
  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 200 })
    .withMessage("Address must not exceed 200 Characters!"),
  // VALIDATING OPTIONAL DAILY MILK FIELD
  body("dailyMilk")
    .optional()
    .isFloat({ min: 0.5 })
    .withMessage("Daily Milk must be at least 0.5 Liters!"),
  // VALIDATING OPTIONAL PRICE PER LITER FIELD
  body("pricePerLiter")
    .optional()
    .isFloat({ min: 1 })
    .withMessage("Price per Liter must be at least ₨1!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== DELETE CUSTOMER VALIDATION RULES ==>
export const validateDeleteCustomer = [
  // VALIDATING CUSTOMER ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Customer ID is Required!")
    .isMongoId()
    .withMessage("Invalid Customer ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== MARK DELIVERY VALIDATION RULES ==>
export const validateMarkDelivery = [
  // VALIDATING CUSTOMER ID PARAM
  param("id")
    .notEmpty()
    .withMessage("Customer ID is Required!")
    .isMongoId()
    .withMessage("Invalid Customer ID!"),
  // VALIDATING DATE FIELD
  body("date")
    .notEmpty()
    .withMessage("Date is Required!")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD Format!"),
  // VALIDATING STATUS FIELD
  body("status")
    .notEmpty()
    .withMessage("Status is Required!")
    .isIn(["delivered", "missed", "unmarked"])
    .withMessage("Status must be delivered, missed, or unmarked!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== ADD PAYMENT VALIDATION RULES ==>
export const validateAddPayment = [
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
    .isLength({ max: 200 })
    .withMessage("Note must not exceed 200 Characters!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
