// <== IMPORTS ==>
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwtUtils.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
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
    sameSite: "lax",
    maxAge: accessTokenMaxAge,
  });
  // SETTING REFRESH TOKEN IN HTTP-ONLY COOKIE
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: refreshTokenMaxAge,
  });
};

/**
 * USER REGISTER
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== USER REGISTER ==>
export const register = expressAsyncHandler(async (req, res) => {
  // GETTING USER DATA FROM REQUEST BODY
  const { fullName, email, password, phoneNumber } = req.body;
  // VALIDATING REQUIRED FIELDS
  if (!fullName || !email || !password) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Full Name, Email, and Password are Required!",
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
  // VALIDATING PASSWORD LENGTH (MINIMUM 8 CHARACTERS)
  if (password.length < 8) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Password must be at least 8 Characters Long!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING FOR UPPERCASE LETTER IN PASSWORD
  if (!/[A-Z]/.test(password)) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Password must Contain at least one Uppercase Letter!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING FOR LOWERCASE LETTER IN PASSWORD
  if (!/[a-z]/.test(password)) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Password must Contain at least One Lowercase Letter!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING FOR DIGIT IN PASSWORD
  if (!/[0-9]/.test(password)) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Password must Contain at least One Digit!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING FOR SPECIAL CHARACTER IN PASSWORD
  if (!/[^A-Za-z0-9]/.test(password)) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Password must Contain at least One Special Character!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // VALIDATING PHONE NUMBER FORMAT IF PROVIDED
  let formattedPhoneNumber = null;
  // IF PHONE NUMBER IS PROVIDED, VALIDATE AND FORMAT IT
  if (phoneNumber) {
    // TRIMMING PHONE NUMBER
    const trimmedPhone = phoneNumber.trim();
    // E.164 FORMAT REGEX VALIDATION
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    // IF PHONE NUMBER FORMAT IS INVALID, RETURN 400 ERROR
    if (!phoneRegex.test(trimmedPhone)) {
      // RETURNING ERROR RESPONSE
      res.status(400).json({
        message:
          "Please Provide a Valid Phone Number with Country Code (e.g., +1234567890)!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // SETTING FORMATTED PHONE NUMBER
    formattedPhoneNumber = trimmedPhone;
    // CHECKING IF PHONE NUMBER IS ALREADY IN USE
    const existingPhoneUser = await User.findOne({
      phoneNumber: formattedPhoneNumber,
    })
      .lean()
      .exec();
    // IF PHONE NUMBER ALREADY EXISTS, RETURN 409 ERROR
    if (existingPhoneUser) {
      // RETURNING ERROR RESPONSE
      res.status(409).json({
        message: "A User with this Phone Number Already Exists!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
  }
  // CHECKING IF A USER WITH THIS EMAIL ALREADY EXISTS
  const existingUser = await User.findOne({ email }).lean().exec();
  // IF USER ALREADY EXISTS, RETURN 409 ERROR
  if (existingUser) {
    // RETURNING ERROR RESPONSE
    res.status(409).json({
      message: "A User with this Email Already Exists!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // HASHING USER PASSWORD WITH BCRYPT
  const hashedPassword = await bcrypt.hash(password, 10);
  // CREATING NEW USER IN DATABASE
  const newUser = await User.create({
    fullName,
    email,
    password: hashedPassword,
    phoneNumber: formattedPhoneNumber,
  });
  // GENERATING ACCESS TOKEN FOR NEW USER
  const accessToken = generateAccessToken(newUser._id.toString());
  // GENERATING REFRESH TOKEN FOR NEW USER
  const refreshToken = generateRefreshToken(newUser._id.toString());
  // SETTING AUTH COOKIES ON RESPONSE
  setAuthCookies(res, accessToken, refreshToken);
  // RETURNING SUCCESS RESPONSE WITH SAFE USER DATA
  res.status(201).json({
    message: "Account Created Successfully!",
    success: true,
    data: {
      id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      phoneNumber: newUser.phoneNumber,
    },
  });
  return;
});

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
  // GENERATING ACCESS TOKEN FOR USER
  const accessToken = generateAccessToken(user._id.toString());
  // GENERATING REFRESH TOKEN FOR USER
  const refreshToken = generateRefreshToken(user._id.toString());
  // SETTING AUTH COOKIES ON RESPONSE
  setAuthCookies(res, accessToken, refreshToken);
  // RETURNING SUCCESS RESPONSE WITH SAFE USER DATA
  res.status(200).json({
    message: "Login Successful!",
    success: true,
    data: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
    },
  });
  return;
});

/**
 * REFRESH ACCESS TOKEN
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
  // GENERATING NEW ACCESS TOKEN
  const newAccessToken = generateAccessToken(user._id.toString());
  // GENERATING NEW REFRESH TOKEN
  const newRefreshToken = generateRefreshToken(user._id.toString());
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
    sameSite: "lax",
  });
  // CLEARING REFRESH TOKEN COOKIE
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Logout Successful!",
    success: true,
  });
  return;
});
