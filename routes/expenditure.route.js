// <== IMPORTS ==>
import {
  validateAddExpenditure,
  validateGetExpenditures,
  validateUpdateExpenditure,
  validateDeleteExpenditure,
} from "../validators/expenditure.validator.js";
import {
  addExpenditure,
  getExpenditures,
  updateExpenditure,
  deleteExpenditure,
} from "../controllers/expenditure.controller.js";
import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { requireRole, requirePermission } from "../middleware/authorize.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW EXPENDITURE
router.post(
  "/",
  requirePermission("expenditures", "write"),
  validateAddExpenditure,
  addExpenditure,
);
// GET ALL EXPENDITURES WITH FILTERS, PAGINATION, AND STATS
router.get(
  "/",
  requirePermission("expenditures", "read"),
  validateGetExpenditures,
  getExpenditures,
);
// UPDATE AN EXISTING EXPENDITURE
router.put(
  "/:id",
  requirePermission("expenditures", "update"),
  validateUpdateExpenditure,
  updateExpenditure,
);
// DELETE AN EXPENDITURE — ADMIN AND ABOVE ONLY, NEVER DELEGABLE VIA THE PERMISSION MATRIX
router.delete(
  "/:id",
  requireRole("superadmin", "admin"),
  validateDeleteExpenditure,
  deleteExpenditure,
);

// <== EXPORTING ROUTER ==>
export default router;
