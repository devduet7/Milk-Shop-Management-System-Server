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

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW QUICK SALE RECORD
router.post("/", validateAddQuickSale, addQuickSale);
// GET QUICK SALES WITH STATS FOR THE SELECTED FILTER AND PRODUCT TYPE
router.get("/", validateGetQuickSales, getQuickSales);
// UPDATE AN EXISTING QUICK SALE RECORD
router.put("/:id", validateUpdateQuickSale, updateQuickSale);
// DELETE A QUICK SALE RECORD
router.delete("/:id", validateDeleteQuickSale, deleteQuickSale);

// <== EXPORTING ROUTER ==>
export default router;
