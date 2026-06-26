// <== IMPORTS ==>
import {
  SecurityCode,
  SECURITY_CODE_PURPOSES,
} from "../models/securityCode.model.js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import expressAsyncHandler from "express-async-handler";
import { User, USER_ROLES } from "../models/user.model.js";
import { sendInviteOtp } from "../services/emailService.js";

// <== HELPER: GENERATE 6-DIGIT OTP CODE ==>
const generateOtpCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// <== HELPER: BUILD SAFE USER OBJECT FOR API RESPONSES ==>
const buildSafeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  permissions: user.permissions || null,
  isActive: user.isActive,
  hasSetPassword: user.hasSetPassword,
  createdBy: user.createdBy || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * LIST ALL USERS UNDER THIS ACCOUNT WITH OPTIONAL SEARCH AND ROLE FILTER
 * ADMIN-AND-ABOVE ONLY — GATED AT ROUTER LEVEL
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== LIST USERS ==>
export const listUsers = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING OPTIONAL SEARCH QUERY
  const search = req.query.search?.trim() || "";
  // GETTING OPTIONAL ROLE FILTER
  const roleFilter = req.query.role?.trim() || "";
  // PARSING PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING LIMIT
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  // CALCULATING SKIP
  const skip = (page - 1) * limit;
  // BUILDING BASE QUERY — SCOPED TO THIS ACCOUNT
  const matchQuery = { accountId };
  // APPLYING SEARCH FILTER IF PROVIDED — SEARCHES FULL NAME AND EMAIL
  if (search) {
    // FILTERING BY FULL NAME OR EMAIL USING CASE-INSENSITIVE REGEX
    matchQuery.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  // APPLYING ROLE FILTER IF PROVIDED
  if (roleFilter) matchQuery.role = roleFilter;
  // FETCHING TOTAL COUNT AND PAGINATED USERS IN PARALLEL
  const [total, users] = await Promise.all([
    User.countDocuments(matchQuery),
    User.find(matchQuery)
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);
  // CALCULATING TOTAL PAGES
  const totalPages = Math.ceil(total / limit);
  // RETURNING SUCCESS RESPONSE WITH PAGINATED SAFE USER OBJECTS
  res.status(200).json({
    message: "Team Members Fetched Successfully!",
    success: true,
    data: {
      records: users.map(buildSafeUser),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * INVITE A NEW USER TO THIS ACCOUNT
 * SUPERADMIN CAN INVITE ADMIN OR USER-TIER
 * ADMIN CAN ONLY INVITE USER-TIER
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== INVITE USER ==>
export const inviteUser = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID AND ACTOR DETAILS FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING ACTOR'S ROLE FROM REQUEST
  const actorRole = req.role;
  // GETTING ACTOR'S ID FOR createdBy ATTRIBUTION
  const actorId = req.id;
  // GETTING INVITE DATA FROM REQUEST BODY
  const { fullName, email, role, permissions } = req.body;
  // GUARD: ONLY SUPERADMIN CAN INVITE ADMIN-TIER USERS
  if (role === USER_ROLES.ADMIN && actorRole !== USER_ROLES.SUPERADMIN) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "Only the Superadmin can Invite Admin Users!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING EMAIL UNIQUENESS GLOBALLY — EMAIL MUST BE UNIQUE ACROSS ALL ACCOUNTS
  const existingUser = await User.findOne({
    email: email.toLowerCase().trim(),
  })
    .lean()
    .exec();
  // IF EMAIL IS ALREADY IN USE
  if (existingUser) {
    // RETURNING CONFLICT RESPONSE
    res.status(409).json({
      message: "A User with this Email Already Exists!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GENERATING A CRYPTOGRAPHICALLY RANDOM PLACEHOLDER PASSWORD HASH
  const placeholderPasswordHash = await bcrypt.hash(randomUUID(), 10);
  // BUILDING PERMISSIONS OBJECT — ONLY MEANINGFUL FOR USER-TIER ROLE
  const resolvedPermissions =
    role === USER_ROLES.USER ? permissions : undefined;
  // CREATING THE INVITED USER DOCUMENT WITH hasSetPassword: false
  const invitedUser = await User.create({
    accountId,
    role,
    permissions: resolvedPermissions,
    createdBy: actorId,
    isActive: true,
    hasSetPassword: false,
    tokenVersion: 0,
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    password: placeholderPasswordHash,
  });
  // DELETING ANY STALE INVITE CODES FOR THIS USER BEFORE CREATING A FRESH ONE
  await SecurityCode.deleteMany({
    userId: invitedUser._id,
    purpose: SECURITY_CODE_PURPOSES.ACCOUNT_INVITE,
  });
  // GENERATING 6-DIGIT OTP CODE
  const code = generateOtpCode();
  // HASHING CODE BEFORE STORING — NEVER STORE OTP IN PLAINTEXT
  const hashedCode = await bcrypt.hash(code, 10);
  // CREATING INVITE SECURITY CODE WITH 48-HOUR WINDOW — LONGER THAN OTP FLOWS TO GIVE THE USER TIME
  await SecurityCode.create({
    userId: invitedUser._id,
    hashedCode,
    purpose: SECURITY_CODE_PURPOSES.ACCOUNT_INVITE,
    pendingValue: null,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });
  // SENDING INVITE EMAIL TO THE INVITED USER'S EMAIL ADDRESS
  await sendInviteOtp({
    to: invitedUser.email,
    fullName: invitedUser.fullName,
    code,
    role: invitedUser.role,
  });
  // RETURNING SUCCESS RESPONSE WITH SAFE INVITED USER DATA
  res.status(201).json({
    message: `Invite Sent to ${invitedUser.email} Successfully!`,
    success: true,
    data: {
      user: {
        _id: invitedUser._id,
        fullName: invitedUser.fullName,
        email: invitedUser.email,
        role: invitedUser.role,
        permissions: invitedUser.permissions || null,
        isActive: invitedUser.isActive,
        hasSetPassword: invitedUser.hasSetPassword,
        createdAt: invitedUser.createdAt,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * RESEND INVITE OTP — REFRESHES THE INVITE CODE IF THE 48-HOUR WINDOW EXPIRED
 * OR IF THE INVITED USER REQUESTS A NEW CODE BEFORE SETUP IS COMPLETE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== RESEND INVITE ==>
export const resendInvite = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING TARGET USER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING TARGET USER AND VERIFYING THEY BELONG TO THIS ACCOUNT
  const targetUser = await User.findOne({ _id: id, accountId }).lean().exec();
  // IF TARGET USER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!targetUser) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: RESEND IS ONLY VALID FOR USERS WHO HAVE NOT COMPLETED SETUP YET
  if (targetUser.hasSetPassword) {
    // RETURNING BAD REQUEST — CANNOT RESEND INVITE TO AN ALREADY-ACTIVE ACCOUNT
    res.status(400).json({
      message: "This User has Already Completed Account Setup!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: CANNOT RESEND INVITE TO A DEACTIVATED ACCOUNT
  if (!targetUser.isActive) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message:
        "This Account has been Deactivated. Activate it Before Resending the Invite!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETING ALL EXISTING INVITE CODES FOR THIS USER
  await SecurityCode.deleteMany({
    userId: id,
    purpose: SECURITY_CODE_PURPOSES.ACCOUNT_INVITE,
  });
  // GENERATING FRESH 6-DIGIT OTP CODE
  const code = generateOtpCode();
  // HASHING CODE BEFORE STORING
  const hashedCode = await bcrypt.hash(code, 10);
  // CREATING FRESH INVITE SECURITY CODE WITH RENEWED 48-HOUR WINDOW
  await SecurityCode.create({
    userId: id,
    hashedCode,
    purpose: SECURITY_CODE_PURPOSES.ACCOUNT_INVITE,
    pendingValue: null,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });
  // SENDING FRESH INVITE EMAIL
  await sendInviteOtp({
    to: targetUser.email,
    fullName: targetUser.fullName,
    code,
    role: targetUser.role,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: `Invite Resent to ${targetUser.email} Successfully!`,
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * COMPLETE ACCOUNT SETUP — PUBLIC ENDPOINT
 * INVITED USER VERIFIES OTP AND SETS THEIR PASSWORD TO ACTIVATE THEIR ACCOUNT
 * NO isAuthenticated MIDDLEWARE — USER HAS NOT LOGGED IN YET
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== COMPLETE ACCOUNT SETUP ==>
export const completeAccountSetup = expressAsyncHandler(async (req, res) => {
  // GETTING SETUP DATA FROM REQUEST BODY
  const { email, code, newPassword } = req.body;
  // FINDING USER BY EMAIL — GENERIC ERROR ON FAILURE TO PREVENT EMAIL ENUMERATION
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .lean()
    .exec();
  // IF USER NOT FOUND — RETURN GENERIC RESPONSE
  if (!user) {
    // RETURNING GENERIC ERROR RESPONSE
    res.status(400).json({
      message: "Invalid or expired invite. Please contact your administrator.",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: SETUP CAN ONLY BE COMPLETED ONCE — BLOCK IF ALREADY ACTIVE
  if (user.hasSetPassword) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message:
        "Account Setup has Already been Completed. Please Log In Instead.",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: BLOCK DEACTIVATED ACCOUNTS FROM COMPLETING SETUP
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
  // FINDING VALID (NOT EXPIRED, NOT USED) INVITE SECURITY CODE
  const securityCode = await SecurityCode.findOne({
    userId: user._id,
    purpose: SECURITY_CODE_PURPOSES.ACCOUNT_INVITE,
    used: false,
    expiresAt: { $gt: new Date() },
  })
    .select("+hashedCode")
    .lean()
    .exec();
  // IF NO VALID CODE EXISTS
  if (!securityCode) {
    // RETURNING GENERIC EXPIRED RESPONSE
    res.status(400).json({
      message:
        "Invalid or expired invite. Please request a new invite from your administrator.",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: LOCK CODE AFTER 5 FAILED ATTEMPTS — FORCE A NEW INVITE
  if (securityCode.attempts >= 5) {
    // DELETING LOCKED CODE
    await SecurityCode.deleteOne({ _id: securityCode._id });
    // RETURNING LOCKED RESPONSE
    res.status(400).json({
      message:
        "Too many failed attempts. Please request a new invite from your administrator.",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // COMPARING SUBMITTED PLAINTEXT CODE AGAINST STORED BCRYPT HASH
  const isValid = await bcrypt.compare(code, securityCode.hashedCode);
  // IF CODE IS INVALID — INCREMENT ATTEMPT COUNTER
  if (!isValid) {
    // ATOMICALLY INCREMENTING ATTEMPTS COUNTER
    await SecurityCode.updateOne(
      { _id: securityCode._id },
      { $inc: { attempts: 1 } },
    );
    // CALCULATING REMAINING ATTEMPTS
    const remaining = 4 - securityCode.attempts;
    // RETURNING ERROR RESPONSE WITH REMAINING ATTEMPTS
    res.status(400).json({
      message:
        remaining > 0
          ? `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Invalid code. No attempts remaining. Please request a new invite from your administrator.",
      success: false,
      code: "INVALID_CODE",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // HASHING NEW PASSWORD BEFORE STORING
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  // APPLYING NEW PASSWORD, ACTIVATING ACCOUNT, AND CONSUMING CODE IN PARALLEL
  await Promise.all([
    User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      hasSetPassword: true,
    }),
    SecurityCode.updateOne({ _id: securityCode._id }, { used: true }),
  ]);
  // RETURNING SUCCESS — CLIENT SHOULD REDIRECT TO LOGIN
  res.status(200).json({
    message: "Account Setup Completed Successfully! You can now Log In.",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE A USER-TIER USER'S MODULE PERMISSIONS
 * SUPERADMIN AND ADMIN CAN UPDATE — CANNOT TARGET SELF, SUPERADMIN, OR ANOTHER ADMIN
 * INCREMENTS tokenVersion SO NEW PERMISSIONS TAKE EFFECT AT NEXT TOKEN REFRESH
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE USER PERMISSIONS ==>
export const updateUserPermissions = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID AND ACTOR ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING ACTOR'S ID FROM REQUEST
  const actorId = req.id;
  // GETTING TARGET USER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING NEW PERMISSIONS FROM REQUEST BODY
  const { permissions } = req.body;
  // GUARD: CANNOT MODIFY OWN PERMISSIONS
  if (id.toString() === actorId.toString()) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "You cannot Modify Your Own Permissions!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING TARGET USER AND VERIFYING THEY BELONG TO THIS ACCOUNT
  const targetUser = await User.findOne({ _id: id, accountId }).lean().exec();
  // IF TARGET USER NOT FOUND
  if (!targetUser) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: PERMISSIONS ARE ONLY MEANINGFUL FOR USER-TIER — ADMINS AND SUPERADMINS HAVE FULL ACCESS
  if (targetUser.role !== USER_ROLES.USER) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message:
        "Permissions can only be Configured for User-Tier Accounts. Admins and Superadmins have Full Unrestricted Access.",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // UPDATING PERMISSIONS AND INCREMENTING TOKEN VERSION IN ONE ATOMIC OPERATION
  const updatedUser = await User.findByIdAndUpdate(
    id,
    { $set: { permissions }, $inc: { tokenVersion: 1 } },
    { new: true },
  )
    .lean()
    .exec();
  // RETURNING SUCCESS RESPONSE WITH UPDATED USER DATA
  res.status(200).json({
    message: `Permissions Updated for ${updatedUser.fullName} Successfully!`,
    success: true,
    data: {
      user: {
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role,
        permissions: updatedUser.permissions || null,
        isActive: updatedUser.isActive,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * ACTIVATE OR DEACTIVATE A TEAM MEMBER'S ACCOUNT
 * SUPERADMIN CAN CHANGE STATUS FOR ADMINS AND USERS
 * ADMIN CAN CHANGE STATUS FOR USER-TIER ONLY
 * DEACTIVATION INCREMENTS TOKEN VERSION TO KILL ACTIVE SESSIONS AT NEXT REFRESH
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE USER STATUS ==>
export const updateUserStatus = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID AND ACTOR DETAILS FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING ACTOR'S ID FROM REQUEST
  const actorId = req.id;
  // GETTING ACTOR'S ROLE FROM REQUEST
  const actorRole = req.role;
  // GETTING TARGET USER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING NEW STATUS FROM REQUEST BODY
  const { isActive } = req.body;
  // GUARD: CANNOT CHANGE OWN STATUS
  if (id.toString() === actorId.toString()) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "You cannot Change Your Own Account Status!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING TARGET USER AND VERIFYING THEY BELONG TO THIS ACCOUNT
  const targetUser = await User.findOne({ _id: id, accountId }).lean().exec();
  // IF TARGET USER NOT FOUND
  if (!targetUser) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: SUPERADMIN CANNOT BE DEACTIVATED — WOULD LOCK THE ENTIRE ACCOUNT
  if (targetUser.role === USER_ROLES.SUPERADMIN) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "The Superadmin Account cannot be Deactivated!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: ADMIN CANNOT CHANGE ANOTHER ADMIN'S STATUS — ONLY SUPERADMIN CAN
  if (actorRole === USER_ROLES.ADMIN && targetUser.role === USER_ROLES.ADMIN) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "Admins cannot Change the Status of Other Admin Accounts!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // BUILDING UPDATE OPERATION
  const updateOperation = isActive
    ? { $set: { isActive: true } }
    : { $set: { isActive: false }, $inc: { tokenVersion: 1 } };
  // APPLYING STATUS UPDATE
  const updatedUser = await User.findByIdAndUpdate(id, updateOperation, {
    new: true,
  })
    .lean()
    .exec();
  // RETURNING SUCCESS RESPONSE WITH CONTEXT-AWARE MESSAGE
  res.status(200).json({
    message: isActive
      ? `${updatedUser.fullName}'s Account has been Activated!`
      : `${updatedUser.fullName}'s Account has been Deactivated!`,
    success: true,
    data: {
      user: {
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE A TEAM MEMBER'S ACCOUNT AND ALL ASSOCIATED SECURITY CODES
 * SUPERADMIN CAN DELETE ADMINS AND USERS (NOT SELF)
 * ADMIN CAN DELETE USER-TIER ONLY (NOT OTHER ADMINS, NOT SUPERADMIN, NOT SELF)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE USER ==>
export const deleteUser = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID AND ACTOR DETAILS FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING ACTOR'S ID FROM REQUEST
  const actorId = req.id;
  // GETTING ACTOR'S ROLE FROM REQUEST
  const actorRole = req.role;
  // GETTING TARGET USER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GUARD: CANNOT DELETE SELF
  if (id.toString() === actorId.toString()) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "You cannot Delete Your Own Account!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING TARGET USER AND VERIFYING THEY BELONG TO THIS ACCOUNT
  const targetUser = await User.findOne({ _id: id, accountId }).lean().exec();
  // IF TARGET USER NOT FOUND
  if (!targetUser) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: SUPERADMIN CANNOT BE DELETED — WOULD ORPHAN THE ENTIRE ACCOUNT
  if (targetUser.role === USER_ROLES.SUPERADMIN) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "The Superadmin Account cannot be Deleted!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: ADMIN CANNOT DELETE ANOTHER ADMIN — ONLY SUPERADMIN CAN
  if (actorRole === USER_ROLES.ADMIN && targetUser.role === USER_ROLES.ADMIN) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "Admins cannot Delete Other Admin Accounts!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETING USER DOCUMENT AND ALL THEIR SECURITY CODES IN PARALLEL
  await Promise.all([
    User.deleteOne({ _id: id, accountId }),
    SecurityCode.deleteMany({ userId: id }),
  ]);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: `${targetUser.fullName}'s Account has been Deleted Successfully!`,
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
