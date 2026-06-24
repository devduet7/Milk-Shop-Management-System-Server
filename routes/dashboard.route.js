// <== IMPORTS ==>
import {
  validateDashboardSales,
  validateDashboardStaff,
  validateDashboardSummary,
  validateDashboardPurchases,
  validateDashboardCustomers,
  validateDashboardQuickSales,
  validateDashboardExpenditures,
} from "../validators/dashboard.validator.js";
import {
  getDashboardSales,
  getDashboardStaff,
  getDashboardSummary,
  getDashboardPurchases,
  getDashboardCustomers,
  getDashboardQuickSales,
  getDashboardExpenditures,
} from "../controllers/dashboard.controller.js";
import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { requireRole, requirePermission } from "../middleware/authorize.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// GET COMPREHENSIVE DASHBOARD SUMMARY — ALL MODULE STATS FOR THE SELECTED MONTH
router.get(
  "/",
  requirePermission("dashboard", "read"),
  validateDashboardSummary,
  getDashboardSummary,
);
// GET PAGINATED SALES RECORDS FOR THE SELECTED MONTH
router.get(
  "/sales",
  requirePermission("dashboard", "read"),
  validateDashboardSales,
  getDashboardSales,
);
// GET PAGINATED QUICK SALE RECORDS FOR THE SELECTED MONTH
router.get(
  "/quick-sales",
  requirePermission("dashboard", "read"),
  validateDashboardQuickSales,
  getDashboardQuickSales,
);
// GET PAGINATED PURCHASE RECORDS FOR THE SELECTED MONTH
router.get(
  "/purchases",
  requirePermission("dashboard", "read"),
  validateDashboardPurchases,
  getDashboardPurchases,
);
// GET PAGINATED EXPENDITURE RECORDS FOR THE SELECTED MONTH
router.get(
  "/expenditures",
  requirePermission("dashboard", "read"),
  validateDashboardExpenditures,
  getDashboardExpenditures,
);
// GET PAGINATED CUSTOMERS WITH MONTH DELIVERY AND BILLING STATS
router.get(
  "/customers",
  requirePermission("dashboard", "read"),
  validateDashboardCustomers,
  getDashboardCustomers,
);
// GET PAGINATED STAFF MEMBERS WITH MONTH SALARY STATUS — ADMIN-AND-ABOVE ONLY
router.get(
  "/staff",
  requireRole("superadmin", "admin"),
  validateDashboardStaff,
  getDashboardStaff,
);

// <== EXPORTING ROUTER ==>
export default router;
