// <== IMPORTS ==>
import jwt from "jsonwebtoken";

/**
 * GENERATE ACCESS TOKEN
 * @param {string} userId - User ID
 * @returns {string} Access Token
 */
// <== GENERATE ACCESS TOKEN ==>
export const generateAccessToken = (userId) => {
  // GETTING ACCESS TOKEN SECRET FROM ENVIRONMENT VARIABLES
  const secret = process.env.AT_SECRET;
  // IF ACCESS TOKEN SECRET IS NOT DEFINED, THROW AN ERROR
  if (!secret) {
    throw new Error("AT_SECRET is not Defined!");
  }
  // GENERATING AND RETURNING ACCESS TOKEN WITH USER ID AND SECRET
  return jwt.sign({ userId }, secret, {
    // SETTING EXPIRATION TIME FROM ENV OR DEFAULT TO 15 MINUTES
    expiresIn: process.env.AT_EXPIRES_IN || "15m",
  });
};

/**
 * GENERATE REFRESH TOKEN
 * @param {string} userId - User ID
 * @returns {string} Refresh Token
 */
// <== GENERATE REFRESH TOKEN ==>
export const generateRefreshToken = (userId) => {
  // GETTING REFRESH TOKEN SECRET FROM ENVIRONMENT VARIABLES
  const secret = process.env.RT_SECRET;
  // IF REFRESH TOKEN SECRET IS NOT DEFINED, THROW AN ERROR
  if (!secret) {
    throw new Error("RT_SECRET is not Defined!");
  }
  // GENERATING AND RETURNING REFRESH TOKEN WITH USER ID AND SECRET
  return jwt.sign({ userId }, secret, {
    // SETTING EXPIRATION TIME FROM ENV OR DEFAULT TO 30 DAYS
    expiresIn: process.env.RT_EXPIRES_IN || "30d",
  });
};
