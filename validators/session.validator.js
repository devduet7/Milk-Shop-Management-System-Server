// <== IMPORTS ==>
import { param, validationResult } from "express-validator";
import { handleValidationErrors } from "./user.validator.js";

// <== KILL MY SESSION VALIDATION RULES ==>
export const validateKillMySession = [
  // VALIDATING SESSION ID PARAM AS VALID MONGOID
  param("sessionId").isMongoId().withMessage("Invalid Session ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== GET USER SESSIONS VALIDATION RULES ==>
export const validateGetUserSessions = [
  // VALIDATING USER ID PARAM AS VALID MONGOID
  param("userId").isMongoId().withMessage("Invalid User ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== KILL USER SESSION VALIDATION RULES ==>
export const validateKillUserSession = [
  // VALIDATING USER ID PARAM AS VALID MONGOID
  param("userId").isMongoId().withMessage("Invalid User ID!"),
  // VALIDATING SESSION ID PARAM AS VALID MONGOID
  param("sessionId").isMongoId().withMessage("Invalid Session ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

// <== KILL ALL USER SESSIONS VALIDATION RULES ==>
export const validateKillAllUserSessions = [
  // VALIDATING USER ID PARAM AS VALID MONGOID
  param("userId").isMongoId().withMessage("Invalid User ID!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
