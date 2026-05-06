// <== IMPORTS ==>
import { query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== SHARED MONTH + PAGINATION VALIDATION ==>
const monthAndPaginationRules = [
  // VALIDATING OPTIONAL MONTH QUERY PARAM
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // VALIDATING OPTIONAL PAGE QUERY PARAM
  query("page")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("Page must be a Positive Integer!"),
  // VALIDATING OPTIONAL LIMIT QUERY PARAM
  query("limit")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 20 })
    .withMessage("Limit must be Between 1 and 20!"),
];

// <== VALIDATE DASHBOARD SUMMARY QUERY ==>
export const validateDashboardSummary = [
  // VALIDATING OPTIONAL MONTH QUERY PARAM
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VALIDATE DASHBOARD SALES QUERY ==>
export const validateDashboardSales = [
  ...monthAndPaginationRules,
  // VALIDATING OPTIONAL SALE TYPE FILTER
  query("saleType")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["all", "customer", "shop"])
    .withMessage("Sale Type must be all, customer, or shop!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VALIDATE DASHBOARD QUICK SALES QUERY ==>
export const validateDashboardQuickSales = [
  ...monthAndPaginationRules,
  // VALIDATING OPTIONAL PRODUCT TYPE FILTER
  query("productType")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["all", "milk", "yoghurt"])
    .withMessage("Product Type must be all, milk, or yoghurt!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VALIDATE DASHBOARD PURCHASES QUERY ==>
export const validateDashboardPurchases = [
  ...monthAndPaginationRules,
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VALIDATE DASHBOARD EXPENDITURES QUERY ==>
export const validateDashboardExpenditures = [
  ...monthAndPaginationRules,
  // VALIDATING OPTIONAL CATEGORY FILTER
  query("category")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["all", "supplies", "meals", "transport", "misc"])
    .withMessage("Category must be all, supplies, meals, transport, or misc!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VALIDATE DASHBOARD STAFF QUERY ==>
export const validateDashboardStaff = [
  ...monthAndPaginationRules,
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VALIDATE DASHBOARD CUSTOMERS QUERY ==>
export const validateDashboardCustomers = [
  ...monthAndPaginationRules,
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
