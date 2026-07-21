// <== IMPORTS ==>
import express from "express";
import { validateLogin } from "../validators/user.validator.js";
import { loginLimiter, refreshLimiter } from "../middleware/rateLimiter.js";
import { login, logout, refreshToken } from "../controllers/user.controller.js";

// <== ROUTER ==>
const router = express.Router();

// <== ROUTES ==>
// USER LOGOUT ROUTE
router.post("/logout", logout);
// REFRESH TOKEN ROUTE
router.post("/refresh", refreshLimiter, refreshToken);
// USER LOGIN ROUTE
router.post("/login", loginLimiter, validateLogin, login);

// <== EXPORTING ROUTER ==>
export default router;
