// <== IMPORTS ==>
import jwt from "jsonwebtoken";
import { Session } from "../models/session.model.js";
import expressAsyncHandler from "express-async-handler";
import { User, USER_ROLES } from "../models/user.model.js";
import { emitToUser, emitToAccountAdmins } from "../services/socket.js";

// <== HELPER: BUILD A SAFE SESSION OBJECT ==>
const buildSafeSession = (session, currentSessionId) => ({
  _id: session._id,
  deviceType: session.deviceType,
  browser: session.browser,
  os: session.os,
  ipAddress: session.ipAddress,
  isActive: session.isActive,
  loginAt: session.loginAt,
  lastActiveAt: session.lastActiveAt,
  logoutAt: session.logoutAt,
  revokedAt: session.revokedAt,
  isCurrent: currentSessionId
    ? session._id.toString() === currentSessionId
    : false,
});

// <== HELPER: GET THE CURRENT REQUEST'S OWN SESSION ID ==>
const getCurrentSessionId = (req) => {
  // TRYING TO GET THE CURRENT REQUEST'S OWN SESSION ID
  try {
    // GETTING REFRESH TOKEN FROM COOKIES
    const refreshTokenFromCookie = req.cookies.refreshToken;
    // GUARD: NO REFRESH TOKEN COOKIE PRESENT
    if (!refreshTokenFromCookie) return null;
    // DECODING WITHOUT ENFORCING EXPIRY
    const decoded = jwt.verify(refreshTokenFromCookie, process.env.RT_SECRET, {
      ignoreExpiration: true,
    });
    // RETURNING THE SESSION ID, IF PRESENT
    return decoded?.sessionId || null;
  } catch {
    // UNABLE TO DECODE THE REFRESH TOKEN COOKIE, RETURNING NULL
    return null;
  }
};

// <== HELPER: CAN THE ACTOR MANAGE THE TARGET USER'S SESSIONS ==>
const canManageTargetRole = (actorRole, targetRole) => {
  // SUPERADMIN HAS NO RESTRICTIONS
  if (actorRole === USER_ROLES.SUPERADMIN) return true;
  // ADMIN CANNOT MANAGE THE SUPERADMIN'S SESSIONS
  if (actorRole === USER_ROLES.ADMIN)
    // RETURNING TRUE IF THE TARGET IS NOT A SUPERADMIN, FALSE OTHERWISE
    return targetRole !== USER_ROLES.SUPERADMIN;
  // ALL OTHER ROLES CANNOT MANAGE ANYONE'S SESSIONS
  return false;
};

/**
 * GET MY OWN ACTIVE SESSIONS
 * ANY AUTHENTICATED USER CAN VIEW THEIR OWN SESSIONS, REGARDLESS OF ROLE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET MY SESSIONS ==>
export const getMySessions = expressAsyncHandler(async (req, res) => {
  // GETTING THE AUTHENTICATED USER'S ID
  const userId = req.id;
  // GETTING THE CURRENT REQUEST'S OWN SESSION ID FOR "THIS DEVICE" LABELLING
  const currentSessionId = getCurrentSessionId(req);
  // FETCHING ALL ACTIVE SESSIONS FOR THIS USER, MOST RECENTLY ACTIVE FIRST
  const sessions = await Session.find({ userId, isActive: true })
    .sort({ lastActiveAt: -1 })
    .lean()
    .exec();
  // RETURNING SUCCESS RESPONSE WITH SAFE SESSION OBJECTS
  res.status(200).json({
    message: "Sessions Fetched Successfully!",
    success: true,
    data: {
      sessions: sessions.map((s) => buildSafeSession(s, currentSessionId)),
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * KILL ONE OF MY OWN SESSIONS (E.G. "LOG OUT MY OTHER BROWSER")
 * CANNOT BE USED TO KILL THE SESSION THE CURRENT REQUEST IS USING — USE LOGOUT FOR THAT
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== KILL MY SESSION ==>
export const killMySession = expressAsyncHandler(async (req, res) => {
  // GETTING THE AUTHENTICATED USER'S ID
  const userId = req.id;
  // GETTING TARGET SESSION ID FROM REQUEST PARAMS
  const { sessionId } = req.params;
  // GETTING THE CURRENT REQUEST'S OWN SESSION ID
  const currentSessionId = getCurrentSessionId(req);
  // GUARD: CANNOT KILL THE SESSION CURRENTLY IN USE — DIRECT THE USER TO LOGOUT INSTEAD
  if (currentSessionId && sessionId === currentSessionId) {
    // RETURNING BAD REQUEST RESPONSE
    res.status(400).json({
      message:
        "You cannot End Your Current Session this Way. Use Logout Instead!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING AND DEACTIVATING THE SESSION IN ONE ATOMIC OPERATION
  const session = await Session.findOneAndUpdate(
    { _id: sessionId, userId, isActive: true },
    { isActive: false, logoutAt: new Date() },
    { new: true },
  )
    .lean()
    .exec();
  // IF SESSION NOT FOUND, DOES NOT BELONG TO THIS USER, OR WAS ALREADY INACTIVE
  if (!session) {
    // RETURNING NOT FOUND RESPONSE
    res
      .status(404)
      .json({ message: "Session Not Found or Already Ended!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // NOTIFYING THIS USER'S OTHER OPEN TABS/DEVICES THAT THIS SESSION WAS ENDED
  emitToUser(userId, "session:killed", { sessionId, reason: "self_revoked" });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Session Ended Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * GET ANOTHER TEAM MEMBER'S ACTIVE SESSIONS
 * ADMIN-AND-ABOVE ONLY. SUPERADMIN CAN VIEW ANYONE'S; ADMIN CANNOT VIEW THE SUPERADMIN'S
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET USER SESSIONS ==>
export const getUserSessions = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID AND ACTOR ROLE FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING ACTOR'S ROLE FROM REQUEST
  const actorRole = req.role;
  // GETTING TARGET USER ID FROM REQUEST PARAMS
  const { userId } = req.params;
  // FINDING TARGET USER AND VERIFYING THEY BELONG TO THIS ACCOUNT
  const targetUser = await User.findOne({ _id: userId, accountId })
    .select("fullName email role")
    .lean()
    .exec();
  // IF TARGET USER NOT FOUND
  if (!targetUser) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: ADMIN CANNOT VIEW THE SUPERADMIN'S SESSIONS
  if (!canManageTargetRole(actorRole, targetUser.role)) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "You do not have Permission to View this User's Sessions!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FETCHING ALL ACTIVE SESSIONS FOR THE TARGET USER, MOST RECENTLY ACTIVE FIRST
  const sessions = await Session.find({ userId, isActive: true })
    .sort({ lastActiveAt: -1 })
    .lean()
    .exec();
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Sessions Fetched Successfully!",
    success: true,
    data: {
      user: {
        _id: targetUser._id,
        fullName: targetUser.fullName,
        email: targetUser.email,
        role: targetUser.role,
      },
      sessions: sessions.map((s) => buildSafeSession(s, null)),
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * FORCE-KILL A SPECIFIC SESSION BELONGING TO ANOTHER TEAM MEMBER
 * ADMIN-AND-ABOVE ONLY. SUPERADMIN CAN KILL ANYONE'S; ADMIN CANNOT KILL THE SUPERADMIN'S
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== KILL USER SESSION ==>
export const killUserSession = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID, ACTOR ID, AND ACTOR ROLE FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING ACTOR'S ID FROM REQUEST
  const actorId = req.id;
  // GETTING ACTOR'S ROLE FROM REQUEST
  const actorRole = req.role;
  // GETTING TARGET USER ID AND SESSION ID FROM REQUEST PARAMS
  const { userId, sessionId } = req.params;
  // GUARD: USE INDIVIDUAL SESSION MANAGEMENT FOR YOUR OWN ACCOUNT, NOT THIS ROUTE
  if (userId === actorId) {
    // RETURNING BAD REQUEST RESPONSE
    res.status(400).json({
      message:
        "Use Your Own Session Management Endpoint for Your Own Sessions!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING TARGET USER AND VERIFYING THEY BELONG TO THIS ACCOUNT
  const targetUser = await User.findOne({ _id: userId, accountId })
    .select("fullName role")
    .lean()
    .exec();
  // IF TARGET USER NOT FOUND
  if (!targetUser) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: ADMIN CANNOT KILL THE SUPERADMIN'S SESSIONS
  if (!canManageTargetRole(actorRole, targetUser.role)) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "You do not have Permission to Manage this User's Sessions!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING AND DEACTIVATING THE SESSION IN ONE ATOMIC OPERATION, RECORDING WHO REVOKED IT
  const session = await Session.findOneAndUpdate(
    { _id: sessionId, userId, isActive: true },
    { isActive: false, revokedBy: actorId, revokedAt: new Date() },
    { new: true },
  )
    .lean()
    .exec();
  // IF SESSION NOT FOUND, DOES NOT BELONG TO THIS USER, OR WAS ALREADY INACTIVE
  if (!session) {
    // RETURNING NOT FOUND RESPONSE
    res
      .status(404)
      .json({ message: "Session Not Found or Already Ended!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // NOTIFYING THE TARGET USER'S OTHER TABS/DEVICES THAT THIS SESSION WAS FORCE-ENDED
  emitToUser(userId, "session:killed", { sessionId, reason: "admin_revoked" });
  // NOTIFYING OTHER ADMIN DASHBOARDS WATCHING THIS ACCOUNT
  emitToAccountAdmins(accountId, "session:killed", {
    userId,
    sessionId,
    reason: "admin_revoked",
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: `Session Ended for ${targetUser.fullName} Successfully!`,
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * FORCE-KILL ALL ACTIVE SESSIONS FOR A TEAM MEMBER
 * ADMIN-AND-ABOVE ONLY. SUPERADMIN CAN KILL ANYONE'S; ADMIN CANNOT KILL THE SUPERADMIN'S
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== KILL ALL USER SESSIONS ==>
export const killAllUserSessions = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID, ACTOR ID, AND ACTOR ROLE FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING ACTOR'S ID FROM REQUEST
  const actorId = req.id;
  // GETTING ACTOR'S ROLE FROM REQUEST
  const actorRole = req.role;
  // GETTING TARGET USER ID FROM REQUEST PARAMS
  const { userId } = req.params;
  // GUARD: USE INDIVIDUAL SESSION MANAGEMENT FOR YOUR OWN ACCOUNT, NOT THIS ROUTE
  if (userId === actorId) {
    // RETURNING BAD REQUEST RESPONSE
    res.status(400).json({
      message: "You cannot Bulk-Revoke Your Own Sessions!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING TARGET USER AND VERIFYING THEY BELONG TO THIS ACCOUNT
  const targetUser = await User.findOne({ _id: userId, accountId })
    .select("fullName role")
    .lean()
    .exec();
  // IF TARGET USER NOT FOUND
  if (!targetUser) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: ADMIN CANNOT BULK-REVOKE THE SUPERADMIN'S SESSIONS
  if (!canManageTargetRole(actorRole, targetUser.role)) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "You do not have Permission to Manage this User's Sessions!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DEACTIVATING ALL ACTIVE SESSIONS FOR THE TARGET USER, RECORDING WHO REVOKED THEM AND WHEN
  await Promise.all([
    Session.updateMany(
      { userId, isActive: true },
      { isActive: false, revokedBy: actorId, revokedAt: new Date() },
    ),
    User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }),
  ]);
  // NOTIFYING THE TARGET USER'S TABS/DEVICES THAT ALL SESSIONS WERE ENDED
  emitToUser(userId, "session:all_killed", { reason: "admin_bulk_revoked" });
  // NOTIFYING OTHER ADMIN DASHBOARDS WATCHING THIS ACCOUNT
  emitToAccountAdmins(accountId, "session:all_killed", {
    userId,
    reason: "admin_bulk_revoked",
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: `All Sessions Ended for ${targetUser.fullName} Successfully!`,
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
