// <== IMPORTS ==>
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwtUtils.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Account } from "../models/account.model.js";
import expressAsyncHandler from "express-async-handler";

// <== HELPER: SET AUTH COOKIES ==>
const setAuthCookies = (res, accessToken, refreshToken) => {
  // CALCULATING ACCESS TOKEN MAX AGE FROM ENV OR DEFAULT TO 15 MINUTES
  const accessTokenExpiresIn = process.env.AT_EXPIRES_IN || "15m";
  // PARSING ACCESS TOKEN MAX AGE IN MILLISECONDS
  const accessTokenMaxAge = accessTokenExpiresIn.includes("m")
    ? parseInt(accessTokenExpiresIn) * 60 * 1000
    : 15 * 60 * 1000;
  // CALCULATING REFRESH TOKEN MAX AGE FROM ENV OR DEFAULT TO 30 DAYS
  const refreshTokenExpiresIn = process.env.RT_EXPIRES_IN || "30d";
  // PARSING REFRESH TOKEN MAX AGE IN MILLISECONDS
  const refreshTokenMaxAge = refreshTokenExpiresIn.includes("d")
    ? parseInt(refreshTokenExpiresIn) * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
  // SETTING ACCESS TOKEN IN HTTP-ONLY COOKIE
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: accessTokenMaxAge,
  });
  // SETTING REFRESH TOKEN IN HTTP-ONLY COOKIE
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: refreshTokenMaxAge,
  });
};

/**
 * USER LOGIN
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== USER LOGIN ==>
export const login = expressAsyncHandler(async (req, res) => {
  // GETTING USER DATA FROM REQUEST BODY
  const { email, password } = req.body;
  // VALIDATING REQUIRED FIELDS
  if (!email || !password) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Email and Password are Required!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // VALIDATING EMAIL FORMAT
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // IF EMAIL FORMAT IS INVALID, RETURN 400 ERROR
  if (!emailRegex.test(email)) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Please Provide a Valid Email Address!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING USER BY EMAIL AND INCLUDING PASSWORD FIELD (EXCLUDED BY DEFAULT)
  const user = await User.findOne({ email }).select("+password").lean().exec();
  // IF USER NOT FOUND, RETURN 401 ERROR (GENERIC MESSAGE FOR SECURITY)
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "User Account Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // COMPARING PROVIDED PASSWORD WITH STORED HASHED PASSWORD
  const isPasswordMatch = await bcrypt.compare(password, user.password || "");
  // IF PASSWORD DOES NOT MATCH, RETURN 401 ERROR
  if (!isPasswordMatch) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "Invalid Email or Password!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING IF THE USER ACCOUNT HAS BEEN DEACTIVATED — CHECKED AFTER PASSWORD MATCH SINCE IDENTITY IS ALREADY CONFIRMED
  if (!user.isActive) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message:
        "Your Account has been Deactivated. Please Contact your Administrator!",
      success: false,
      code: "ACCOUNT_DEACTIVATED",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING IF THE USER HAS COMPLETED ACCOUNT SETUP (INVITED USERS MUST SET A PASSWORD FIRST)
  if (!user.hasSetPassword) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "Please Complete your Account Setup before Logging In!",
      success: false,
      code: "ACCOUNT_SETUP_INCOMPLETE",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FETCHING ACCOUNT CONFIG TO INCLUDE BUSINESS RATES IN LOGIN RESPONSE
  const account = await Account.findById(user.accountId).lean().exec();
  // GENERATING ACCESS TOKEN WITH USER IDENTITY, ACCOUNT, ROLE, AND PERMISSIONS
  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    accountId: user.accountId.toString(),
    role: user.role,
    permissions: user.permissions || null,
  });
  // GENERATING REFRESH TOKEN WITH USER IDENTITY AND CURRENT TOKEN VERSION
  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    tokenVersion: user.tokenVersion,
  });
  // SETTING AUTH COOKIES ON RESPONSE
  setAuthCookies(res, accessToken, refreshToken);
  // RETURNING SUCCESS RESPONSE WITH SAFE USER DATA AND ACCOUNT-LEVEL BUSINESS CONFIG
  res.status(200).json({
    message: "Login Successful!",
    success: true,
    data: {
      id: user._id,
      accountId: user.accountId,
      role: user.role,
      permissions: user.permissions || null,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      milkRate: account?.milkRate ?? 120,
      yoghurtRate: account?.yoghurtRate ?? 180,
      dailyReportsEnabled: account?.dailyReportsEnabled ?? false,
      monthlyReportsEnabled: account?.monthlyReportsEnabled ?? false,
    },
  });
  return;
});

/**
 * REFRESH ACCESS TOKEN
 * RE-FETCHES THE USER ON EVERY CALL TO ENSURE THE USER IS STILL ACTIVE AND HASN'T BEEN DEACTIVATED OR DELETED
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== REFRESH ACCESS TOKEN ==>
export const refreshToken = expressAsyncHandler(async (req, res) => {
  // GETTING REFRESH TOKEN FROM COOKIES
  const refreshTokenFromCookie = req.cookies.refreshToken;
  // IF NO REFRESH TOKEN FOUND IN COOKIES, RETURN 401 ERROR
  if (!refreshTokenFromCookie) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "Refresh Token Not Found!",
      success: false,
      code: "NO_REFRESH_TOKEN",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // INITIATING DECODED TOKEN
  let decodedToken;
  try {
    // VERIFYING AND DECODING THE REFRESH TOKEN
    decodedToken = jwt.verify(refreshTokenFromCookie, process.env.RT_SECRET);
  } catch (error) {
    // IF REFRESH TOKEN IS EXPIRED
    if (error.name === "TokenExpiredError") {
      // RETURNING ERROR RESPONSE WITH EXPIRED CODE (CLIENT SHOULD REDIRECT TO LOGIN)
      res.status(401).json({
        message: "Refresh Token Expired! Please LogIn Again.",
        success: false,
        code: "REFRESH_TOKEN_EXPIRED",
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // IF REFRESH TOKEN IS INVALID OR ANY OTHER ERROR OCCURS
    res.status(401).json({
      message: "Invalid Refresh Token!",
      success: false,
      code: "INVALID_REFRESH_TOKEN",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // VALIDATING DECODED TOKEN PAYLOAD
  if (!decodedToken || !decodedToken.userId) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "Invalid Refresh Token Payload!",
      success: false,
      code: "INVALID_TOKEN_PAYLOAD",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // VERIFYING USER STILL EXISTS IN DATABASE
  const user = await User.findById(decodedToken.userId).lean().exec();
  // IF USER NOT FOUND (ACCOUNT DELETED), RETURN 401 ERROR
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "User Account Not Found! Please LogIn Again.",
      success: false,
      code: "USER_NOT_FOUND",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING IF THE TOKEN VERSION MATCHES
  if (decodedToken.tokenVersion !== user.tokenVersion) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "Session has been Revoked! Please LogIn Again.",
      success: false,
      code: "SESSION_REVOKED",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING IF THE USER ACCOUNT HAS BEEN DEACTIVATED SINCE THE LAST REFRESH
  if (!user.isActive) {
    // RETURNING ERROR RESPONSE
    res.status(403).json({
      message:
        "Your Account has been Deactivated. Please Contact your Administrator!",
      success: false,
      code: "ACCOUNT_DEACTIVATED",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GENERATING NEW ACCESS TOKEN WITH FRESH ACCOUNT, ROLE, AND PERMISSIONS
  const newAccessToken = generateAccessToken({
    userId: user._id.toString(),
    accountId: user.accountId.toString(),
    role: user.role,
    permissions: user.permissions || null,
  });
  // GENERATING NEW REFRESH TOKEN WITH CURRENT TOKEN VERSION
  const newRefreshToken = generateRefreshToken({
    userId: user._id.toString(),
    tokenVersion: user.tokenVersion,
  });
  // SETTING NEW AUTH COOKIES ON RESPONSE
  setAuthCookies(res, newAccessToken, newRefreshToken);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Token Refreshed Successfully!",
    success: true,
  });
  return;
});

/**
 * USER LOGOUT
 * @param {import("express").Request} _req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== USER LOGOUT ==>
export const logout = expressAsyncHandler(async (_req, res) => {
  // CLEARING ACCESS TOKEN COOKIE
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  // CLEARING REFRESH TOKEN COOKIE
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Logout Successful!",
    success: true,
  });
  return;
});
