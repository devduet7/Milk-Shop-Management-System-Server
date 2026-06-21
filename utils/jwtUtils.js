// <== IMPORTS ==>
import jwt from "jsonwebtoken";

/**
 * GENERATE ACCESS TOKEN
 * @param {object} payload - ACCESS TOKEN PAYLOAD
 * @param {string} payload.userId - USER ID
 * @param {string} payload.accountId - ACCOUNT ID OF THE USER BELONGS TO
 * @param {string} payload.role - USER ROLE (SUPERADMIN | ADMIN | USER)
 * @param {object|null} payload.permissions - PER MODULE PERMISSION MATRIX
 * @returns {string} ACCESS TOKEN
 */
// <== GENERATE ACCESS TOKEN ==>
export const generateAccessToken = ({
  userId,
  accountId,
  role,
  permissions,
}) => {
  // GETTING ACCESS TOKEN SECRET FROM ENVIRONMENT VARIABLES
  const secret = process.env.AT_SECRET;
  // IF ACCESS TOKEN SECRET IS NOT DEFINED, THROW AN ERROR
  if (!secret) {
    // THROWING ERROR IF AT_SECRET IS NOT DEFINED IN ENVIRONMENT VARIABLES
    throw new Error("AT_SECRET is not Defined!");
  }
  // GENERATING AND RETURNING ACCESS TOKEN WITH USER ID, ACCOUNT ID, ROLE, AND PERMISSIONS
  return jwt.sign(
    { userId, accountId, role, permissions: permissions || null },
    secret,
    {
      // SETTING EXPIRATION TIME FROM ENV OR DEFAULT TO 15 MINUTES
      expiresIn: process.env.AT_EXPIRES_IN || "15m",
    },
  );
};

/**
 * GENERATE REFRESH TOKEN
 * @param {object} payload - REFRESH TOKEN PAYLOAD
 * @param {string} payload.userId - USER ID
 * @param {number} payload.tokenVersion - CURRENT TOKEN VERSION (FOR FORCED SESSION INVALIDATION)
 * @returns {string} REFRESH TOKEN
 */
// <== GENERATE REFRESH TOKEN ==>
export const generateRefreshToken = ({ userId, tokenVersion }) => {
  // GETTING REFRESH TOKEN SECRET FROM ENVIRONMENT VARIABLES
  const secret = process.env.RT_SECRET;
  // IF REFRESH TOKEN SECRET IS NOT DEFINED, THROW AN ERROR
  if (!secret) {
    // THROWING ERROR IF RT_SECRET IS NOT DEFINED IN ENVIRONMENT VARIABLES
    throw new Error("RT_SECRET is not Defined!");
  }
  // GENERATING AND RETURNING REFRESH TOKEN WITH USER ID AND TOKEN VERSION
  return jwt.sign({ userId, tokenVersion }, secret, {
    // SETTING EXPIRATION TIME FROM ENV OR DEFAULT TO 30 DAYS
    expiresIn: process.env.RT_EXPIRES_IN || "30d",
  });
};
