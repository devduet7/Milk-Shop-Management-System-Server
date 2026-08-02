// <== IMPORTS ==>
import { query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== SHARED DATE FILTER + PAGINATION VALIDATION ==>
const dateFilterAndPaginationRules = [
  // VALIDATING OPTIONAL FILTER TYPE
  query("filterType")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["today", "week", "month", "date", "range"])
    .withMessage("Filter Type must be today, week, month, date, or range!"),
  // VALIDATING OPTIONAL MONTH QUERY PARAM
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // VALIDATING OPTIONAL DATE FOR THE DATE FILTER
  query("date")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD Format!"),
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

// <== SHARED MONTH-ONLY + PAGINATION VALIDATION ==>
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
  ...dateFilterAndPaginationRules,
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VALIDATE DASHBOARD SALES QUERY ==>
export const validateDashboardSales = [
  ...dateFilterAndPaginationRules,
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
  ...dateFilterAndPaginationRules,
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
  ...dateFilterAndPaginationRules,
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== VALIDATE DASHBOARD EXPENDITURES QUERY ==>
export const validateDashboardExpenditures = [
  ...dateFilterAndPaginationRules,
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

// <== VALIDATE DASHBOARD MILK LOGS QUERY ==>
export const validateDashboardMilkLogs = [
  ...dateFilterAndPaginationRules,
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
