// <== IMPORTS ==>
import {
  validateGetStaff,
  validateAddStaff,
  validatePaySalary,
  validateUpdateStaff,
  validateDeleteStaff,
  validateAddExtraAllocation,
  validateGetExtraAllocations,
} from "../validators/staff.validator.js";
import {
  addStaff,
  getStaff,
  paySalary,
  updateStaff,
  deleteStaff,
  addExtraAllocation,
  getExtraAllocations,
} from "../controllers/staff.controller.js";
import express from "express";
import { requireRole } from "../middleware/authorize.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== APPLYING ROLE GATE AT ROUTER LEVEL ==>
router.use(requireRole("superadmin", "admin"));

// <== ROUTES ==>
// GET ALL STAFF MEMBERS WITH MONTH SALARY STATUS AND STATS
router.get("/", validateGetStaff, getStaff);
// ADD A NEW STAFF MEMBER
router.post("/", validateAddStaff, addStaff);
// UPDATE AN EXISTING STAFF MEMBER
router.put("/:id", validateUpdateStaff, updateStaff);
// DELETE A STAFF MEMBER AND ALL RELATED RECORDS
router.delete("/:id", validateDeleteStaff, deleteStaff);
// RECORD A SALARY PAYMENT FOR A STAFF MEMBER'S BILLING MONTH
router.patch("/:id/salary", validatePaySalary, paySalary);
// ADD AN EXTRA MONEY ALLOCATION FOR A STAFF MEMBER
router.post("/:id/extra", validateAddExtraAllocation, addExtraAllocation);
// GET EXTRA ALLOCATION HISTORY FOR A STAFF MEMBER (LAZY)
router.get("/:id/extra", validateGetExtraAllocations, getExtraAllocations);

// <== EXPORTING ROUTER ==>
export default router;
