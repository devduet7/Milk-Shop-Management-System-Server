// <== IMPORTS ==>
import {
  parseDurationToMs,
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwtUtils.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UAParser } from "ua-parser-js";
import { User } from "../models/user.model.js";
import { Account } from "../models/account.model.js";
import expressAsyncHandler from "express-async-handler";
import { Session, DEVICE_TYPES } from "../models/session.model.js";
import { emitToUser, emitToAccountAdmins } from "../services/socket.js";

// <== SESSION EXPIRY BUFFER ==>
const SESSION_EXPIRY_BUFFER_MS = 24 * 60 * 60 * 1000;

// <== HELPER: SET AUTH COOKIES ==>
const setAuthCookies = (res, accessToken, refreshToken) => {
  // CALCULATING ACCESS TOKEN MAX AGE FROM ENV OR DEFAULT TO 15 MINUTES
  const accessTokenMaxAge = parseDurationToMs(
    env.AT_EXPIRES_IN,
    15 * 60 * 1000,
  );
  // CALCULATING REFRESH TOKEN MAX AGE FROM ENV OR DEFAULT TO 30 DAYS
  const refreshTokenMaxAge = parseDurationToMs(
    env.RT_EXPIRES_IN,
    30 * 24 * 60 * 60 * 1000,
  );
  // SETTING ACCESS TOKEN IN HTTP-ONLY COOKIE
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: accessTokenMaxAge,
  });
  // SETTING REFRESH TOKEN IN HTTP-ONLY COOKIE
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: refreshTokenMaxAge,
  });
};

// <== HELPER: PARSE USER-AGENT INTO DEVICE TYPE, BROWSER, AND OS LABELS ==>
const parseUserAgent = (userAgentString) => {
  // GUARD: NO USER-AGENT HEADER PRESENT
  if (!userAgentString) {
    // RETURNING UNKNOWN DEFAULTS
    return {
      deviceType: DEVICE_TYPES.UNKNOWN,
      browser: "Unknown Browser",
      os: "Unknown OS",
    };
  }
  // PARSING THE USER-AGENT STRING
  const parser = new UAParser(userAgentString);
  // GETTING PARSED RESULT
  const result = parser.getResult();
  // RESOLVING DEVICE TYPE
  const resolvedDeviceType =
    result.device.type === "mobile"
      ? DEVICE_TYPES.MOBILE
      : result.device.type === "tablet"
        ? DEVICE_TYPES.TABLET
        : DEVICE_TYPES.DESKTOP;
  // BUILDING BROWSER LABEL
  const browserLabel = result.browser.name
    ? `${result.browser.name}${result.browser.major ? ` ${result.browser.major}` : ""}`
    : "Unknown Browser";
  // BUILDING OS LABEL
  const osLabel = result.os.name
    ? `${result.os.name}${result.os.version ? ` ${result.os.version}` : ""}`
    : "Unknown OS";
  // RETURNING PARSED DEVICE INFO
  return { deviceType: resolvedDeviceType, browser: browserLabel, os: osLabel };
};

/**
 * USER LOGIN
 * VALIDATES USER CREDENTIALS, CREATES A NEW SESSION, AND ISSUES ACCESS AND REFRESH TOKENS
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
  // CHECKING IF THE USER ACCOUNT HAS BEEN DEACTIVATED
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
  // PARSING THE REQUEST'S USER-AGENT HEADER INTO DEVICE TYPE, BROWSER, AND OS
  const { deviceType, browser, os } = parseUserAgent(req.headers["user-agent"]);
  // CALCULATING SESSION EXPIRY — MIRRORS THE REFRESH TOKEN LIFETIME PLUS A SAFETY BUFFER
  const sessionExpiresAt = new Date(
    Date.now() +
      parseDurationToMs(env.RT_EXPIRES_IN, 30 * 24 * 60 * 60 * 1000) +
      SESSION_EXPIRY_BUFFER_MS,
  );
  // CREATING THE SESSION DOCUMENT
  const session = await Session.create({
    userId: user._id,
    accountId: user.accountId,
    deviceType,
    browser,
    os,
    ipAddress: req.ip || null,
    userAgent: req.headers["user-agent"] || null,
    isActive: true,
    loginAt: new Date(),
    lastActiveAt: new Date(),
    expiresAt: sessionExpiresAt,
  });
  // GENERATING ACCESS TOKEN WITH USER IDENTITY, ACCOUNT, ROLE, AND PERMISSIONS
  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    accountId: user.accountId.toString(),
    role: user.role,
    permissions: user.permissions || null,
  });
  // GENERATING REFRESH TOKEN WITH USER IDENTITY, CURRENT TOKEN VERSION, AND THE NEW SESSION ID
  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    tokenVersion: user.tokenVersion,
    sessionId: session._id.toString(),
  });
  // SETTING AUTH COOKIES ON RESPONSE
  setAuthCookies(res, accessToken, refreshToken);
  // NOTIFYING THIS USER'S OTHER TABS/DEVICES OF THE NEW SESSION
  emitToUser(user._id.toString(), "session:new", {
    session: {
      _id: session._id,
      deviceType,
      browser,
      os,
      loginAt: session.loginAt,
    },
  });
  // NOTIFYING ADMIN DASHBOARDS WATCHING THIS ACCOUNT'S TEAM ACTIVITY
  emitToAccountAdmins(user.accountId.toString(), "session:new", {
    userId: user._id,
    session: {
      _id: session._id,
      deviceType,
      browser,
      os,
      loginAt: session.loginAt,
    },
  });
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
 * VALIDATES THE PROVIDED REFRESH TOKEN, CHECKS SESSION AND USER STATUS, AND ISSUES A NEW ACCESS TOKEN
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
    decodedToken = jwt.verify(refreshTokenFromCookie, env.RT_SECRET);
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
  if (!decodedToken || !decodedToken.userId || !decodedToken.sessionId) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "Invalid Refresh Token Payload!",
      success: false,
      code: "INVALID_TOKEN_PAYLOAD",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FETCHING THE USER AND THE SESSION IN PARALLEL
  const [user, session] = await Promise.all([
    User.findById(decodedToken.userId).lean().exec(),
    Session.findById(decodedToken.sessionId).lean().exec(),
  ]);
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
  // IF THE SESSION DOCUMENT NO LONGER EXISTS (DELETED VIA TTL EXPIRY OR MANUALLY)
  if (!session) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "Session Not Found! Please LogIn Again.",
      success: false,
      code: "SESSION_NOT_FOUND",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // IF THE SESSION DOCUMENT EXISTS BUT IS MARKED AS INACTIVE (KILLED BY ADMIN OR USER)
  if (!session.isActive) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "This Session has been Ended! Please LogIn Again.",
      success: false,
      code: "SESSION_REVOKED",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DEFENSE IN DEPTH
  if (session.userId.toString() !== user._id.toString()) {
    // RETURNING ERROR RESPONSE
    res.status(401).json({
      message: "Invalid Session! Please LogIn Again.",
      success: false,
      code: "SESSION_MISMATCH",
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
  // CALCULATING THE SLIDING SESSION EXPIRY
  const extendedExpiresAt = new Date(
    Date.now() +
      parseDurationToMs(env.RT_EXPIRES_IN, 30 * 24 * 60 * 60 * 1000) +
      SESSION_EXPIRY_BUFFER_MS,
  );
  // UPDATING THE SESSION DOCUMENT'S FIELDS TO REFLECT THE SLIDING EXPIRY AND LAST ACTIVE TIMESTAMP
  await Session.updateOne(
    { _id: session._id },
    { lastActiveAt: new Date(), expiresAt: extendedExpiresAt },
  );
  // GENERATING NEW ACCESS TOKEN WITH FRESH ACCOUNT, ROLE, AND PERMISSIONS
  const newAccessToken = generateAccessToken({
    userId: user._id.toString(),
    accountId: user.accountId.toString(),
    role: user.role,
    permissions: user.permissions || null,
  });
  // GENERATING NEW REFRESH TOKEN WITH THE SAME TOKEN VERSION AND SESSION ID
  const newRefreshToken = generateRefreshToken({
    userId: user._id.toString(),
    tokenVersion: user.tokenVersion,
    sessionId: session._id.toString(),
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
 * INVALIDATES THE SESSION DOCUMENT ASSOCIATED WITH THE PROVIDED REFRESH TOKEN
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== USER LOGOUT ==>
export const logout = expressAsyncHandler(async (req, res) => {
  // GETTING REFRESH TOKEN FROM COOKIES — MAY BE ABSENT OR EXPIRED, BOTH ARE HANDLED GRACEFULLY
  const refreshTokenFromCookie = req.cookies.refreshToken;
  // IF A REFRESH TOKEN COOKIE IS PRESENT, ATTEMPT TO IDENTIFY AND DEACTIVATE ITS SESSION
  if (refreshTokenFromCookie) {
    try {
      // VERIFYING THE REFRESH TOKEN, IGNORING EXPIRATION — LOGOUT SHOULD STILL DEACTIVATE
      const decodedToken = jwt.verify(refreshTokenFromCookie, env.RT_SECRET, {
        ignoreExpiration: true,
      });
      // IF THE TOKEN CARRIES A SESSION ID, DEACTIVATE THAT SESSION
      if (decodedToken?.sessionId) {
        // DEACTIVATING THE SESSION — BEST-EFFORT, DOES NOT BLOCK THE LOGOUT RESPONSE ON FAILURE
        await Session.updateOne(
          { _id: decodedToken.sessionId },
          { isActive: false, logoutAt: new Date() },
        );
        // NOTIFYING THIS USER'S OTHER TABS/DEVICES AND WATCHING ADMIN DASHBOARDS
        emitToUser(decodedToken.userId, "session:killed", {
          sessionId: decodedToken.sessionId,
          reason: "logout",
        });
      }
    } catch {
      // IF THE REFRESH TOKEN COULD NOT BE VERIFIED, IGNORE IT AND CLEAR COOKIES ANYWAY
    }
  }
  // CLEARING ACCESS TOKEN COOKIE
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  });
  // CLEARING REFRESH TOKEN COOKIE
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Logout Successful!",
    success: true,
  });
  return;
});
