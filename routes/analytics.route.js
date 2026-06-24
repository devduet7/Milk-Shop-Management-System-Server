// <== IMPORTS ==>
import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { requirePermission } from "../middleware/authorize.js";
import { getAnalyticsData } from "../controllers/analytics.controller.js";
import { validateAnalyticsQuery } from "../validators/analytics.validator.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// GET COMPREHENSIVE ANALYTICS CHART DATA FOR THE SELECTED MONTH
router.get(
  "/",
  requirePermission("analytics", "read"),
  validateAnalyticsQuery,
  getAnalyticsData,
);

// <== EXPORTING ROUTER ==>
export default router;
