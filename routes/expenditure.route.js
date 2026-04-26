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

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW EXPENDITURE
router.post("/", validateAddExpenditure, addExpenditure);
// GET ALL EXPENDITURES WITH FILTERS, PAGINATION, AND STATS
router.get("/", validateGetExpenditures, getExpenditures);
// UPDATE AN EXISTING EXPENDITURE
router.put("/:id", validateUpdateExpenditure, updateExpenditure);
// DELETE AN EXPENDITURE
router.delete("/:id", validateDeleteExpenditure, deleteExpenditure);

// <== EXPORTING ROUTER ==>
export default router;
