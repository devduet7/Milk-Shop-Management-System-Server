// <== IMPORTS ==>
import {
  validateKillMySession,
  validateGetUserSessions,
  validateKillUserSession,
  validateKillAllUserSessions,
} from "../validators/session.validator.js";
import {
  killMySession,
  getMySessions,
  getUserSessions,
  killUserSession,
  killAllUserSessions,
} from "../controllers/session.controller.js";
import express from "express";
import { requireRole } from "../middleware/authorize.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// GET MY OWN ACTIVE SESSIONS
router.get("/me", getMySessions);
// KILL ONE OF MY OWN SESSIONS
router.delete("/me/:sessionId", validateKillMySession, killMySession);
// GET ANOTHER TEAM MEMBER'S SESSIONS
router.get(
  "/user/:userId",
  requireRole("superadmin", "admin"),
  validateGetUserSessions,
  getUserSessions,
);
// FORCE-KILL A SPECIFIC SESSION BELONGING TO ANOTHER TEAM MEMBER
router.delete(
  "/user/:userId/:sessionId",
  requireRole("superadmin", "admin"),
  validateKillUserSession,
  killUserSession,
);
// FORCE-KILL ALL ACTIVE SESSIONS FOR A TEAM MEMBER
router.delete(
  "/user/:userId",
  requireRole("superadmin", "admin"),
  validateKillAllUserSessions,
  killAllUserSessions,
);

// <== EXPORTING ROUTER ==>
export default router;
