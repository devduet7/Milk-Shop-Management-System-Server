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

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// GET PAGINATED EXPENDITURE RECORDS FOR THE SELECTED MONTH
router.get(
  "/expenditures",
  validateDashboardExpenditures,
  getDashboardExpenditures,
);
// GET COMPREHENSIVE DASHBOARD SUMMARY — ALL MODULE STATS FOR THE SELECTED MONTH
router.get("/", validateDashboardSummary, getDashboardSummary);
// GET PAGINATED STAFF MEMBERS WITH MONTH SALARY STATUS
router.get("/staff", validateDashboardStaff, getDashboardStaff);
// GET PAGINATED SALES RECORDS FOR THE SELECTED MONTH
router.get("/sales", validateDashboardSales, getDashboardSales);
// GET PAGINATED CUSTOMERS WITH MONTH DELIVERY AND BILLING STATS
router.get("/customers", validateDashboardCustomers, getDashboardCustomers);
// GET PAGINATED PURCHASE RECORDS FOR THE SELECTED MONTH
router.get("/purchases", validateDashboardPurchases, getDashboardPurchases);
// GET PAGINATED QUICK SALE RECORDS FOR THE SELECTED MONTH
router.get("/quick-sales", validateDashboardQuickSales, getDashboardQuickSales);

// <== EXPORTING ROUTER ==>
export default router;
