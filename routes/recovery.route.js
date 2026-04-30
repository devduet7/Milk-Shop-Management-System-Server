// <== IMPORTS ==>
import {
  validateGetRecoveries,
  validateDeleteSaleRecord,
  validateUpdateSalePayment,
  validateAddDeliveryPayment,
} from "../validators/recovery.validator.js";
import {
  getRecoveries,
  deleteSaleRecord,
  updateSalePayment,
  addDeliveryPayment,
} from "../controllers/recovery.controller.js";
import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// GET RECOVERY RECORDS WITH COMBINED STATS (TAB-FILTERED)
router.get("/", validateGetRecoveries, getRecoveries);
// DELETE A CUSTOMER SALE RECORD
router.delete("/sale/:id", validateDeleteSaleRecord, deleteSaleRecord);
// UPDATE PAID AMOUNT ON A CUSTOMER SALE
router.patch("/sale/:id", validateUpdateSalePayment, updateSalePayment);
// ADD PAYMENT FOR A CUSTOMER DELIVERY BILLING MONTH
router.post("/delivery/:id", validateAddDeliveryPayment, addDeliveryPayment);

// <== EXPORTING ROUTER ==>
export default router;
