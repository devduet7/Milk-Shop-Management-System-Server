// <== IMPORTS ==>
import {
  validateAddPayment,
  validateAddCustomer,
  validateGetCustomers,
  validateMarkDelivery,
  validateUpdateCustomer,
  validateDeleteCustomer,
  validateGetCustomerDetail,
} from "../validators/customer.validator.js";
import {
  addPayment,
  addCustomer,
  getCustomers,
  markDelivery,
  updateCustomer,
  deleteCustomer,
  getCustomerDetail,
} from "../controllers/customer.controller.js";
import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW CUSTOMER
router.post("/", validateAddCustomer, addCustomer);
// GET ALL CUSTOMERS WITH MONTHLY STATS
router.get("/", validateGetCustomers, getCustomers);
// UPDATE AN EXISTING CUSTOMER
router.put("/:id", validateUpdateCustomer, updateCustomer);
// ADD A PAYMENT FOR A CUSTOMER
router.post("/:id/payment", validateAddPayment, addPayment);
// DELETE A CUSTOMER
router.delete("/:id", validateDeleteCustomer, deleteCustomer);
// GET SINGLE CUSTOMER DETAIL WITH DELIVERY RECORDS
router.get("/:id", validateGetCustomerDetail, getCustomerDetail);
// MARK OR UPDATE A DELIVERY DAY
router.patch("/:id/delivery", validateMarkDelivery, markDelivery);

// <== EXPORTING ROUTER ==>
export default router;
