// <== IMPORTS ==>
import {
  validateAddPurchase,
  validateGetPurchases,
  validateUpdatePurchase,
  validateDeletePurchase,
} from "../validators/purchase.validator.js";
import {
  addPurchase,
  getPurchases,
  updatePurchase,
  deletePurchase,
} from "../controllers/purchase.controller.js";
import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { requireRole, requirePermission } from "../middleware/authorize.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW PURCHASE
router.post(
  "/",
  requirePermission("purchases", "write"),
  validateAddPurchase,
  addPurchase,
);
// GET ALL PURCHASES WITH FILTERS, PAGINATION, AND STATS
router.get(
  "/",
  requirePermission("purchases", "read"),
  validateGetPurchases,
  getPurchases,
);
// UPDATE AN EXISTING PURCHASE - ONLY SUPERADMIN AND ADMIN CAN UPDATE
router.put(
  "/:id",
  requirePermission("purchases", "update"),
  validateUpdatePurchase,
  updatePurchase,
);
// DELETE A PURCHASE RECORD - ONLY SUPERADMIN AND ADMIN CAN DELETE
router.delete(
  "/:id",
  requireRole("superadmin", "admin"),
  validateDeletePurchase,
  deletePurchase,
);

// <== EXPORTING ROUTER ==>
export default router;
