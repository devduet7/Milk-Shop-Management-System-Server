// <== IMPORTS ==>
import {
  validateAddMilkLog,
  validateGetMilkLogs,
  validateUpdateMilkLog,
  validateDeleteMilkLog,
} from "../validators/milkLog.validator.js";
import {
  addMilkLog,
  getMilkLogs,
  updateMilkLog,
  deleteMilkLog,
} from "../controllers/milkLog.controller.js";
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
// GET MILK LOG ENTRIES WITH FILTERS, PAGINATION, AND STATS
router.get("/", validateGetMilkLogs, getMilkLogs);
// ADD A NEW MILK LOG ENTRY
router.post("/", validateAddMilkLog, addMilkLog);
// UPDATE AN EXISTING MILK LOG ENTRY
router.put("/:id", validateUpdateMilkLog, updateMilkLog);
// DELETE A MILK LOG ENTRY
router.delete("/:id", validateDeleteMilkLog, deleteMilkLog);

// <== EXPORTING ROUTER ==>
export default router;
