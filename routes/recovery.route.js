// <== IMPORTS ==>
import {
  validateGetRecoveries,
  validateDeleteSaleRecord,
  validateUpdateSalePayment,
  validateAddDeliveryPayment,
  validateSetMonthlyDiscount,
  validateAddBulkDeliveryPayment,
} from "../validators/recovery.validator.js";
import {
  getRecoveries,
  deleteSaleRecord,
  updateSalePayment,
  addDeliveryPayment,
  setMonthlyDiscount,
  addBulkDeliveryPayment,
} from "../controllers/recovery.controller.js";
import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { requireRole, requirePermission } from "../middleware/authorize.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// GET RECOVERY RECORDS WITH COMBINED STATS (TAB-FILTERED)
router.get(
  "/",
  requirePermission("recoveries", "read"),
  validateGetRecoveries,
  getRecoveries,
);
// DELETE A CUSTOMER SALE RECORD — ADMIN AND ABOVE ONLY, NEVER DELEGABLE VIA THE PERMISSION MATRIX
router.delete(
  "/sale/:id",
  requireRole("superadmin", "admin"),
  validateDeleteSaleRecord,
  deleteSaleRecord,
);
// UPDATE PAID AMOUNT ON A CUSTOMER SALE
router.patch(
  "/sale/:id",
  requirePermission("recoveries", "update"),
  validateUpdateSalePayment,
  updateSalePayment,
);
// ADD PAYMENT FOR A CUSTOMER DELIVERY BILLING MONTH
router.post(
  "/delivery/:id",
  requirePermission("recoveries", "write"),
  validateAddDeliveryPayment,
  addDeliveryPayment,
);
// ADD A LUMP-SUM DELIVERY PAYMENT AUTO-ALLOCATED ACROSS OUTSTANDING MONTHS, OLDEST FIRST
router.post(
  "/delivery/:id/bulk",
  requirePermission("recoveries", "write"),
  validateAddBulkDeliveryPayment,
  addBulkDeliveryPayment,
);
// SET OR UPDATE A CUSTOMER'S MILK DELIVERY DISCOUNT FOR A BILLING MONTH — UPSERT, HENCE PUT
router.put(
  "/delivery/:id/discount",
  requirePermission("recoveries", "write"),
  validateSetMonthlyDiscount,
  setMonthlyDiscount,
);

// <== EXPORTING ROUTER ==>
export default router;
