// <== IMPORTS ==>
import {
  validateAddQuickSale,
  validateGetQuickSales,
  validateDeleteQuickSale,
  validateUpdateQuickSale,
} from "../validators/quickSale.validator.js";
import {
  addQuickSale,
  getQuickSales,
  deleteQuickSale,
  updateQuickSale,
} from "../controllers/quickSale.controller.js";
import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { requireRole, requirePermission } from "../middleware/authorize.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW QUICK SALE RECORD
router.post(
  "/",
  requirePermission("quickSales", "write"),
  validateAddQuickSale,
  addQuickSale,
);
// GET QUICK SALES WITH STATS FOR THE SELECTED FILTER AND PRODUCT TYPE
router.get(
  "/",
  requirePermission("quickSales", "read"),
  validateGetQuickSales,
  getQuickSales,
);
// UPDATE AN EXISTING QUICK SALE RECORD
router.put(
  "/:id",
  requirePermission("quickSales", "update"),
  validateUpdateQuickSale,
  updateQuickSale,
);
// DELETE A QUICK SALE RECORD — ADMIN AND ABOVE ONLY, NEVER DELEGABLE VIA THE PERMISSION MATRIX
router.delete(
  "/:id",
  requireRole("superadmin", "admin"),
  validateDeleteQuickSale,
  deleteQuickSale,
);

// <== EXPORTING ROUTER ==>
export default router;
