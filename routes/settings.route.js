// <== IMPORTS ==>
import {
  validateVerifyCode,
  validateUpdateAddress,
  validateUpdatePricing,
  validateUpdateFullName,
  validateCancelSecurityCode,
  validateResetForgotPassword,
  validateInitiatePhoneChange,
  validateInitiateEmailChange,
  validateUpdateReportSettings,
  validateCancelForgotPassword,
  validateInitiateForgotPassword,
  validateInitiatePasswordChange,
  validateVerifyForgotPasswordOtp,
} from "../validators/settings.validator.js";
import {
  getProfile,
  uploadAvatar,
  deleteAvatar,
  updateAddress,
  updatePricing,
  updateFullName,
  verifyPhoneChange,
  cancelSecurityCode,
  resetForgotPassword,
  initiatePhoneChange,
  initiateEmailChange,
  verifyPasswordChange,
  cancelForgotPassword,
  updateReportSettings,
  initiateForgotPassword,
  initiatePasswordChange,
  verifyForgotPasswordOtp,
  verifyNewEmailForChange,
  verifyCurrentEmailForChange,
} from "../controllers/settings.controller.js";
import multer from "multer";
import express from "express";
import { avatarUpload } from "../middleware/multer.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

// <== ROUTER ==>
const router = express.Router();

// INITIATE FORGOT PASSWORD
router.post(
  "/forgot-password/initiate",
  validateInitiateForgotPassword,
  initiateForgotPassword,
);
// VERIFY FORGOT PASSWORD OTP
router.post(
  "/forgot-password/verify",
  validateVerifyForgotPasswordOtp,
  verifyForgotPasswordOtp,
);
// RESET FORGOT PASSWORD
router.post(
  "/forgot-password/reset",
  validateResetForgotPassword,
  resetForgotPassword,
);
// CANCEL FORGOT PASSWORD
router.post(
  "/forgot-password/cancel",
  validateCancelForgotPassword,
  cancelForgotPassword,
);

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== AVATAR UPLOAD MIDDLEWARE WRAPPER — HANDLES MULTER ERRORS GRACEFULLY ==>
const handleAvatarUpload = (req, res, next) => {
  // CALL MULTER UPLOAD FUNCTION
  avatarUpload(req, res, (err) => {
    // HANDLE MULTER-SPECIFIC ERRORS
    if (err instanceof multer.MulterError) {
      // FILE SIZE LIMIT ERROR
      if (err.code === "LIMIT_FILE_SIZE") {
        // RETURN FRIENDLY ERROR MESSAGE FOR FILE SIZE EXCEEDING LIMIT
        return res
          .status(400)
          .json({ message: "Image must be Smaller than 5MB!", success: false });
      }
      // OTHER MULTER ERRORS
      return res.status(400).json({ message: err.message, success: false });
    }
    // HANDLE FILE TYPE FILTER ERRORS
    if (err) {
      // RETURN FRIENDLY ERROR MESSAGE FOR INVALID FILE TYPE OR OTHER ERRORS
      return res
        .status(400)
        .json({ message: err.message || "Invalid File!", success: false });
    }
    // IF NO ERRORS, PROCEED TO CONTROLLER
    next();
  });
};

// <== ROUTES ==>
// CANCEL PENDING SECURITY CODE
router.delete(
  "/security-code/:purpose",
  validateCancelSecurityCode,
  cancelSecurityCode,
);
// INITIATE PHONE NUMBER CHANGE
router.post(
  "/phone/initiate",
  validateInitiatePhoneChange,
  initiatePhoneChange,
);
// INITIATE EMAIL CHANGE
router.post(
  "/email/initiate",
  validateInitiateEmailChange,
  initiateEmailChange,
);
// VERIFY CURRENT EMAIL OTP
router.post(
  "/email/verify-current",
  validateVerifyCode,
  verifyCurrentEmailForChange,
);
// INITIATE PASSWORD CHANGE
router.post(
  "/password/initiate",
  validateInitiatePasswordChange,
  initiatePasswordChange,
);
// GET FULL USER PROFILE
router.get("/profile", getProfile);
// DELETE AVATAR
router.delete("/avatar", deleteAvatar);
// UPLOAD OR REPLACE AVATAR
router.put("/avatar", handleAvatarUpload, uploadAvatar);
// UPDATE FULL NAME
router.patch("/name", validateUpdateFullName, updateFullName);
// UPDATE ADDRESS
router.patch("/address", validateUpdateAddress, updateAddress);
// UPDATE PRICING
router.patch("/pricing", validateUpdatePricing, updatePricing);
// VERIFY PHONE CHANGE OTP
router.post("/phone/verify", validateVerifyCode, verifyPhoneChange);
// VERIFY PASSWORD CHANGE OTP
router.post("/password/verify", validateVerifyCode, verifyPasswordChange);
// UPDATE REPORT SETTINGS
router.patch("/reports", validateUpdateReportSettings, updateReportSettings);
// VERIFY NEW EMAIL OTP
router.post("/email/verify-new", validateVerifyCode, verifyNewEmailForChange);

// <== EXPORTING ROUTER ==>
export default router;
