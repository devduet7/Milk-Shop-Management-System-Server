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

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW SALE (CUSTOMER OR SHOP)
router.post("/", validateAddSale, addSale);
// GET SALES WITH FILTERS, PAGINATION, AND COMBINED STATS
router.get("/", validateGetSales, getSales);
// UPDATE AN EXISTING SALE
router.put("/:id", validateUpdateSale, updateSale);
// DELETE A SALE
router.delete("/:id", validateDeleteSale, deleteSale);

// <== EXPORTING ROUTER ==>
export default router;
