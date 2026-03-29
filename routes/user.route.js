// <== IMPORTS ==>
import {
  validateRegister,
  validateLogin,
} from "../validators/user.validator.js";
import {
  register,
  login,
  logout,
  refreshToken,
} from "../controllers/user.controller.js";
import express from "express";

// <== ROUTER ==>
const router = express.Router();

// <== ROUTES ==>
// USER LOGOUT ROUTE
router.post("/logout", logout);
// REFRESH TOKEN ROUTE
router.post("/refresh", refreshToken);
// USER LOGIN ROUTE
router.post("/login", validateLogin, login);
// USER REGISTER ROUTE
router.post("/register", validateRegister, register);

// <== EXPORTING ROUTER ==>
export default router;
