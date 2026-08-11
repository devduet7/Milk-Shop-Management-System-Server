// <== IMPORTS ==>
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * PARSE A DURATION STRING INTO MILLISECONDS
 * SHARED BY COOKIE MAX-AGE CALCULATION AND SESSION EXPIRY CALCULATION SO BOTH STAY IN SYNC
 * @param {string} durationStr - DURATION STRING WITH A NUMERIC PREFIX AND A UNIT SUFFIX
 * @param {number} fallbackMs - FALLBACK VALUE IN MILLISECONDS IF PARSING FAILS
 * @returns {number} DURATION IN MILLISECONDS
 */
// <== PARSE DURATION TO MILLISECONDS ==>
export const parseDurationToMs = (durationStr, fallbackMs) => {
  // GUARD: NO DURATION STRING PROVIDED
  if (!durationStr) return fallbackMs;
  // MATCHING A NUMERIC PREFIX FOLLOWED BY A UNIT SUFFIX
  const match = /^(\d+)\s*(m|h|d)$/i.exec(durationStr.trim());
  // IF THE STRING DOES NOT MATCH THE EXPECTED FORMAT, FALL BACK
  if (!match) return fallbackMs;
  // EXTRACTING THE NUMERIC VALUE
  const value = parseInt(match[1], 10);
  // EXTRACTING THE UNIT, LOWERCASED
  const unit = match[2].toLowerCase();
  // CONVERTING TO MILLISECONDS BASED ON UNIT
  if (unit === "m") return value * 60 * 1000;
  // CONVERTING HOURS TO MILLISECONDS
  if (unit === "h") return value * 60 * 60 * 1000;
  // DEFAULT: DAYS
  return value * 24 * 60 * 60 * 1000;
};

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
  // GENERATING AND RETURNING ACCESS TOKEN WITH USER ID, ACCOUNT ID, ROLE, AND PERMISSIONS
  return jwt.sign(
    { userId, accountId, role, permissions: permissions || null },
    env.AT_SECRET,
    {
      // SETTING EXPIRATION TIME — GUARANTEED PRESENT BY BOOT-TIME VALIDATION
      expiresIn: env.AT_EXPIRES_IN || "15m",
    },
  );
};

/**
 * GENERATE REFRESH TOKEN
 * NOW EMBEDS SESSION ID ALONGSIDE TOKEN VERSION FOR BULK SESSION INVALIDATION
 * @param {object} payload - REFRESH TOKEN PAYLOAD
 * @param {string} payload.userId - USER ID
 * @param {number} payload.tokenVersion - CURRENT TOKEN VERSION (FOR BULK SESSION INVALIDATION)
 * @param {string} payload.sessionId - THE SESSION ID OF THE DOCUMENT THIS TOKEN BELONGS TO
 * @returns {string} REFRESH TOKEN
 */
// <== GENERATE REFRESH TOKEN ==>
export const generateRefreshToken = ({ userId, tokenVersion, sessionId }) => {
  // GENERATING AND RETURNING REFRESH TOKEN WITH USER ID, TOKEN VERSION, AND SESSION ID
  return jwt.sign({ userId, tokenVersion, sessionId }, env.RT_SECRET, {
    // SETTING EXPIRATION TIME — GUARANTEED PRESENT BY BOOT-TIME VALIDATION
    expiresIn: env.RT_EXPIRES_IN || "30d",
  });
};
