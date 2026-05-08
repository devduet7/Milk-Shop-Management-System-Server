// <== IMPORTS ==>
import { query } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== VALIDATE ANALYTICS QUERY ==>
export const validateAnalyticsQuery = [
  // VALIDATING OPTIONAL MONTH QUERY PARAM
  query("month")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}$/)
    .withMessage("Month must be in YYYY-MM Format!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
