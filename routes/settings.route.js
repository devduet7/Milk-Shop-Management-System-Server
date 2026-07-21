// <== IMPORTS ==>
import {
  securityCodeLimiter,
  avatarUploadLimiter,
  forgotPasswordLimiter,
} from "../middleware/rateLimiter.js";
import {
  validateVerifyCode,
  validateUpdateAddress,
  validateUpdatePricing,
  validateUpdateFullName,
  validateCancelSecurityCode,
  validateResetForgotPassword,
  validateInitiatePhoneChange,
  validateInitiateEmailChange,
  validateUpdateTrashSettings,
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
  updateTrashSettings,
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
import { requireRole } from "../middleware/authorize.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

// <== ROUTER ==>
const router = express.Router();

// <== PUBLIC ROUTES — FORGOT PASSWORD FLOW (NO AUTH REQUIRED) ==>
// INITIATE FORGOT PASSWORD
router.post(
  "/forgot-password/initiate",
  forgotPasswordLimiter,
  validateInitiateForgotPassword,
  initiateForgotPassword,
);
// VERIFY FORGOT PASSWORD OTP
router.post(
  "/forgot-password/verify",
  forgotPasswordLimiter,
  validateVerifyForgotPasswordOtp,
  verifyForgotPasswordOtp,
);
// RESET FORGOT PASSWORD
router.post(
  "/forgot-password/reset",
  forgotPasswordLimiter,
  validateResetForgotPassword,
  resetForgotPassword,
);
// CANCEL FORGOT PASSWORD
router.post(
  "/forgot-password/cancel",
  forgotPasswordLimiter,
  validateCancelForgotPassword,
  cancelForgotPassword,
);

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES BELOW ==>
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

// <== ROUTES OPEN TO ALL AUTHENTICATED USERS (PERSONAL PROFILE MANAGEMENT) ==>
// CANCEL PENDING SECURITY CODE
router.delete(
  "/security-code/:purpose",
  validateCancelSecurityCode,
  cancelSecurityCode,
);
// INITIATE PHONE NUMBER CHANGE
router.post(
  "/phone/initiate",
  securityCodeLimiter,
  validateInitiatePhoneChange,
  initiatePhoneChange,
);
// INITIATE EMAIL CHANGE
router.post(
  "/email/initiate",
  securityCodeLimiter,
  validateInitiateEmailChange,
  initiateEmailChange,
);
// VERIFY CURRENT EMAIL OTP (STEP 1 OF EMAIL CHANGE)
router.post(
  "/email/verify-current",
  securityCodeLimiter,
  validateVerifyCode,
  verifyCurrentEmailForChange,
);
// INITIATE PASSWORD CHANGE
router.post(
  "/password/initiate",
  securityCodeLimiter,
  validateInitiatePasswordChange,
  initiatePasswordChange,
);
// GET FULL USER PROFILE
router.get("/profile", getProfile);
// DELETE AVATAR
router.delete("/avatar", deleteAvatar);
// UPLOAD OR REPLACE AVATAR
router.put("/avatar", avatarUploadLimiter, handleAvatarUpload, uploadAvatar);
// UPDATE FULL NAME
router.patch("/name", validateUpdateFullName, updateFullName);
// UPDATE ADDRESS
router.patch("/address", validateUpdateAddress, updateAddress);
// VERIFY PHONE CHANGE OTP
router.post(
  "/phone/verify",
  securityCodeLimiter,
  validateVerifyCode,
  verifyPhoneChange,
);
// VERIFY PASSWORD CHANGE OTP
router.post(
  "/password/verify",
  securityCodeLimiter,
  validateVerifyCode,
  verifyPasswordChange,
);
// VERIFY NEW EMAIL OTP (STEP 2 OF EMAIL CHANGE)
router.post(
  "/email/verify-new",
  securityCodeLimiter,
  validateVerifyCode,
  verifyNewEmailForChange,
);
// UPDATE PRICING (MILK AND YOGHURT RATES — ACCOUNT-LEVEL, AFFECTS ALL USERS)
router.patch(
  "/pricing",
  requireRole("superadmin", "admin"),
  validateUpdatePricing,
  updatePricing,
);
// UPDATE REPORT SETTINGS (AUTOMATED REPORT TOGGLES — ACCOUNT-LEVEL, AFFECTS ALL USERS)
router.patch(
  "/reports",
  requireRole("superadmin", "admin"),
  validateUpdateReportSettings,
  updateReportSettings,
);
// UPDATE TRASH SETTINGS (DELETION MODE + RETENTION DAYS — ACCOUNT-LEVEL, AFFECTS ALL USERS)
router.patch(
  "/trash",
  requireRole("superadmin", "admin"),
  validateUpdateTrashSettings,
  updateTrashSettings,
);

// <== EXPORTING ROUTER ==>
export default router;
