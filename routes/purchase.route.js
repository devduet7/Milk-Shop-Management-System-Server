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

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW PURCHASE
router.post("/", validateAddPurchase, addPurchase);
// GET ALL PURCHASES WITH FILTERS, PAGINATION, AND STATS
router.get("/", validateGetPurchases, getPurchases);
// UPDATE AN EXISTING PURCHASE
router.put("/:id", validateUpdatePurchase, updatePurchase);
// DELETE A PURCHASE
router.delete("/:id", validateDeletePurchase, deletePurchase);

// <== EXPORTING ROUTER ==>
export default router;
