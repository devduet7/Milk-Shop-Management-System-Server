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
import { requireRole, requirePermission } from "../middleware/authorize.js";

// <== ROUTER ==>
const router = express.Router();

// <== APPLYING AUTHENTICATION MIDDLEWARE TO ALL ROUTES ==>
router.use(isAuthenticated);

// <== ROUTES ==>
// ADD A NEW CUSTOMER
router.post(
  "/",
  requirePermission("customers", "write"),
  validateAddCustomer,
  addCustomer,
);
// GET ALL CUSTOMERS WITH MONTHLY STATS
router.get(
  "/",
  requirePermission("customers", "read"),
  validateGetCustomers,
  getCustomers,
);
// UPDATE AN EXISTING CUSTOMER
router.put(
  "/:id",
  requirePermission("customers", "update"),
  validateUpdateCustomer,
  updateCustomer,
);
// ADD A PAYMENT FOR A CUSTOMER
router.post(
  "/:id/payment",
  requirePermission("customers", "write"),
  validateAddPayment,
  addPayment,
);
// DELETE A CUSTOMER — ADMIN AND ABOVE ONLY, NEVER DELEGABLE VIA THE PERMISSION MATRIX
router.delete(
  "/:id",
  requireRole("superadmin", "admin"),
  validateDeleteCustomer,
  deleteCustomer,
);
// GET SINGLE CUSTOMER DETAIL WITH DELIVERY RECORDS
router.get(
  "/:id",
  requirePermission("customers", "read"),
  validateGetCustomerDetail,
  getCustomerDetail,
);
// MARK OR UPDATE A DELIVERY DAY
router.patch(
  "/:id/delivery",
  requirePermission("customers", "write"),
  validateMarkDelivery,
  markDelivery,
);

// <== EXPORTING ROUTER ==>
export default router;
