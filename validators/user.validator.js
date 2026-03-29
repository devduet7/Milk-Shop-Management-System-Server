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

// <== REGISTER VALIDATION RULES ==>
export const validateRegister = [
  // VALIDATING FULL NAME FIELD
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full Name is Required!")
    .isLength({ min: 2, max: 50 })
    .withMessage("Full Name must be Between 2 and 50 Characters!"),
  // VALIDATING EMAIL FIELD
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is Required!")
    .isEmail()
    .withMessage("Please Provide a Valid Email Address!")
    .normalizeEmail(),
  // VALIDATING PASSWORD FIELD
  body("password")
    .notEmpty()
    .withMessage("Password is Required!")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 Characters Long!")
    .matches(/[A-Z]/)
    .withMessage("Password must Contain at least One Uppercase Letter!")
    .matches(/[a-z]/)
    .withMessage("Password must Contain at least One Lowercase Letter!")
    .matches(/[0-9]/)
    .withMessage("Password must Contain at least One Digit!")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must Contain at least One Special Character!"),
  // VALIDATING PHONE NUMBER FIELD (OPTIONAL)
  body("phoneNumber")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage(
      "Please Provide a valid Phone Number with Country Code (e.g., +1234567890)!",
    ),
  // HANDLING VALIDATION ERRORS
  handleValidationErrors,
];

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
