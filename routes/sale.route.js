// <== IMPORTS ==>
import {
  validateAddSale,
  validateGetSales,
  validateUpdateSale,
  validateDeleteSale,
} from "../validators/sale.validator.js";
import {
  addSale,
  getSales,
  updateSale,
  deleteSale,
} from "../controllers/sale.controller.js";
import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { requireRole, requirePermission } from "../middleware/authorize.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW SALE (CUSTOMER OR SHOP)
router.post("/", requirePermission("sales", "write"), validateAddSale, addSale);
// GET SALES WITH FILTERS, PAGINATION, AND COMBINED STATS
router.get("/", requirePermission("sales", "read"), validateGetSales, getSales);
// UPDATE AN EXISTING SALE
router.put(
  "/:id",
  requirePermission("sales", "update"),
  validateUpdateSale,
  updateSale,
);
// DELETE A SALE — ADMIN AND ABOVE ONLY, NEVER DELEGABLE VIA THE PERMISSION MATRIX
router.delete(
  "/:id",
  requireRole("superadmin", "admin"),
  validateDeleteSale,
  deleteSale,
);

// <== EXPORTING ROUTER ==>
export default router;
