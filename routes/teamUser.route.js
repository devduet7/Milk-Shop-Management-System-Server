// <== IMPORTS ==>
import {
  validateListUsers,
  validateInviteUser,
  validateDeleteUser,
  validateResendInvite,
  validateUpdateStatus,
  validateCompleteSetup,
  validateUpdatePermissions,
} from "../validators/teamUser.validator.js";
import {
  listUsers,
  inviteUser,
  deleteUser,
  resendInvite,
  updateUserStatus,
  completeAccountSetup,
  updateUserPermissions,
} from "../controllers/teamUser.controller.js";
import express from "express";
import { requireRole } from "../middleware/authorize.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

// <== ROUTER ==>
const router = express.Router();

// <== PUBLIC ROUTE — NO AUTH REQUIRED ==>
// COMPLETE ACCOUNT SETUP — INVITED USER SETS PASSWORD AND ACTIVATES THEIR ACCOUNT
router.post("/setup", validateCompleteSetup, completeAccountSetup);

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES BELOW ==>
router.use(isAuthenticated);

// <== APPLYING ROLE GATE AT ROUTER LEVEL ==>
router.use(requireRole("superadmin", "admin"));

// <== ROUTES ==>
// LIST ALL USERS UNDER THIS ACCOUNT
router.get("/", validateListUsers, listUsers);
// DELETE A USER AND ALL THEIR SECURITY CODES
router.delete("/:id", validateDeleteUser, deleteUser);
// INVITE A NEW USER TO THIS ACCOUNT
router.post("/invite", validateInviteUser, inviteUser);
// ACTIVATE OR DEACTIVATE A USER'S ACCOUNT
router.patch("/:id/status", validateUpdateStatus, updateUserStatus);
// RESEND INVITE OTP TO A PENDING USER
router.post("/:id/resend-invite", validateResendInvite, resendInvite);
// UPDATE A USER-TIER USER'S MODULE PERMISSIONS
router.patch(
  "/:id/permissions",
  validateUpdatePermissions,
  updateUserPermissions,
);

// <== EXPORTING ROUTER ==>
export default router;
