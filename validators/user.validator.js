// <== IMPORTS ==>
import { body, validationResult } from "express-validator";

/**
 * HANDLE VALIDATION ERRORS
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @param {import("express").NextFunction} next - Next Function
 * @returns {void}
 */
// <== HANDLE VALIDATION ERRORS ==>
export const handleValidationErrors = (req, res, next) => {
  // GETTING VALIDATION ERRORS FROM REQUEST
  const errors = validationResult(req);
  // IF VALIDATION ERRORS EXIST, RETURN 400 ERROR WITH FIRST ERROR MESSAGE
  if (!errors.isEmpty()) {
    // RETURNING ERROR RESPONSE WITH FIRST VALIDATION ERROR
    res.status(400).json({
      message: errors.array()[0].msg,
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // NO ERRORS, CALLING NEXT MIDDLEWARE
  next();
};

// <== LOGIN VALIDATION RULES ==>
export const validateLogin = [
  // VALIDATING EMAIL FIELD
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is Required!")
    .isEmail()
    .withMessage("Please Provide a valid Email Address!")
    .normalizeEmail(),
  // VALIDATING PASSWORD FIELD
  body("password").notEmpty().withMessage("Password is Required!"),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];
