// <== IMPORTS ==>
import {
  sendPhoneChangeOtp,
  sendPasswordChangeOtp,
  sendEmailChangeNewOtp,
  sendForgotPasswordOtp,
  sendEmailChangeCurrentOtp,
} from "../services/emailService.js";
import {
  SecurityCode,
  SECURITY_CODE_PURPOSES,
} from "../models/securityCode.model.js";
import bcrypt from "bcryptjs";
import getDataURI from "../utils/dataURI.js";
import { User } from "../models/user.model.js";
import cloudinary from "../utils/cloudinary.js";
import { Account } from "../models/account.model.js";
import expressAsyncHandler from "express-async-handler";

// <== HELPER: GENERATE 6-DIGIT OTP CODE ==>
const generateOtpCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// <== HELPER: BUILD SAFE USER PROFILE OBJECT FOR API RESPONSES ==>
const buildUserProfile = (user, account) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  address: user.address,
  avatar: user.avatar?.url
    ? { url: user.avatar.url, publicId: user.avatar.publicId }
    : null,
  milkRate: account?.milkRate ?? 120,
  yoghurtRate: account?.yoghurtRate ?? 180,
  dailyReportsEnabled: account?.dailyReportsEnabled ?? false,
  monthlyReportsEnabled: account?.monthlyReportsEnabled ?? false,
});

// <== HELPER: VERIFY AND CONSUME A SECURITY CODE ==>
const verifyAndConsumeCode = async (userId, purpose, submittedCode) => {
  // FINDING VALID (NOT EXPIRED, NOT USED) SECURITY CODE — INCLUDE HASHED CODE FIELD
  const securityCode = await SecurityCode.findOne({
    userId,
    purpose,
    used: false,
    expiresAt: { $gt: new Date() },
  })
    .select("+hashedCode")
    .lean()
    .exec();
  // IF NO VALID CODE EXISTS FOR THIS USER AND PURPOSE
  if (!securityCode) {
    // RETURNING ERROR RESPONSE
    return {
      success: false,
      error: "Code expired or not found. Please request a new code.",
      code: "CODE_NOT_FOUND",
    };
  }
  // GUARD: LOCK CODE AFTER 5 FAILED ATTEMPTS — DELETE AND REJECT
  if (securityCode.attempts >= 5) {
    // DELETING LOCKED CODE
    await SecurityCode.deleteOne({ _id: securityCode._id });
    // RETURNING ERROR RESPONSE
    return {
      success: false,
      error: "Too many failed attempts. Please request a new code.",
      code: "MAX_ATTEMPTS",
    };
  }
  // COMPARING SUBMITTED PLAINTEXT CODE AGAINST STORED BCRYPT HASH
  const isValid = await bcrypt.compare(submittedCode, securityCode.hashedCode);
  // IF CODE IS INVALID — INCREMENT ATTEMPT COUNTER
  if (!isValid) {
    // USING $INC OPERATOR TO ATOMICALLY INCREMENT ATTEMPTS FIELD IN DATABASE
    await SecurityCode.updateOne(
      { _id: securityCode._id },
      { $inc: { attempts: 1 } },
    );
    // CALCULATING REMAINING ATTEMPTS FOR ERROR MESSAGE
    const remaining = 4 - securityCode.attempts;
    // RETURNING ERROR RESPONSE WITH REMAINING ATTEMPTS INFO
    return {
      success: false,
      error:
        remaining > 0
          ? `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Invalid code. No attempts remaining. Please request a new code.",
      code: "INVALID_CODE",
    };
  }
  // MARKING CODE AS USED TO PREVENT REPLAY ATTACKS
  await SecurityCode.updateOne({ _id: securityCode._id }, { used: true });
  // RETURNING SUCCESS WITH PENDING VALUE
  return { success: true, pendingValue: securityCode.pendingValue };
};

/**
 * GET FULL USER PROFILE INCLUDING ALL SETTINGS FIELDS
 * FETCHES BOTH USER (PERSONAL DATA) AND ACCOUNT (BUSINESS CONFIG) IN PARALLEL
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET PROFILE ==>
export const getProfile = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID AND ACCOUNT ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // FETCHING USER AND ACCOUNT IN PARALLEL — NEITHER DEPENDS ON THE OTHER
  const [user, account] = await Promise.all([
    User.findById(userId).lean().exec(),
    Account.findById(accountId).lean().exec(),
  ]);
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // RETURNING SAFE USER PROFILE WITH COMBINED USER AND ACCOUNT DATA
  res.status(200).json({
    message: "Profile Fetched Successfully!",
    success: true,
    data: buildUserProfile(user, account),
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE FULL NAME — NO OTP REQUIRED
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE FULL NAME ==>
export const updateFullName = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID AND ACCOUNT ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING ACCOUNT ID FOR PROFILE RESPONSE
  const accountId = req.accountId;
  // GETTING NEW FULL NAME FROM REQUEST BODY
  const { fullName } = req.body;
  // UPDATING USER AND FETCHING ACCOUNT IN PARALLEL — ACCOUNT DATA IS NEEDED FOR THE PROFILE RESPONSE
  const [user, account] = await Promise.all([
    User.findByIdAndUpdate(userId, { fullName: fullName.trim() }, { new: true })
      .lean()
      .exec(),
    Account.findById(accountId).lean().exec(),
  ]);
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // RETURNING UPDATED PROFILE
  res.status(200).json({
    message: "Name Updated Successfully!",
    success: true,
    data: buildUserProfile(user, account),
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE ADDRESS — NO OTP REQUIRED, NULLABLE FIELD
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE ADDRESS ==>
export const updateAddress = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID AND ACCOUNT ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING ACCOUNT ID FOR PROFILE RESPONSE
  const accountId = req.accountId;
  // GETTING ADDRESS FROM REQUEST BODY (NULL-COALESCED TO ALLOW CLEARING)
  const { address } = req.body;
  // UPDATING USER AND FETCHING ACCOUNT IN PARALLEL — ACCOUNT DATA IS NEEDED FOR THE PROFILE RESPONSE
  const [user, account] = await Promise.all([
    User.findByIdAndUpdate(
      userId,
      { address: address?.trim() || null },
      { new: true },
    )
      .lean()
      .exec(),
    Account.findById(accountId).lean().exec(),
  ]);
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // RETURNING UPDATED PROFILE
  res.status(200).json({
    message: "Address Updated Successfully!",
    success: true,
    data: buildUserProfile(user, account),
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * INITIATE PHONE CHANGE — VALIDATES NEW NUMBER, SENDS OTP TO CURRENT EMAIL
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== INITIATE PHONE CHANGE ==>
export const initiatePhoneChange = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING NEW PHONE NUMBER FROM REQUEST BODY
  const { newPhone } = req.body;
  // FINDING CURRENT USER
  const user = await User.findById(userId).lean().exec();
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: REJECT IF NEW PHONE IS THE SAME AS CURRENT
  if (user.phoneNumber === newPhone) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "New phone number is the Same as Your Current Number!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: CHECK IF PHONE IS ALREADY ASSOCIATED WITH ANOTHER ACCOUNT
  const existingPhone = await User.findOne({
    phoneNumber: newPhone,
    _id: { $ne: userId },
  })
    .lean()
    .exec();
  // IF PHONE ALREADY EXISTS
  if (existingPhone) {
    // RETURNING ERROR RESPONSE
    res.status(409).json({
      message: "This Phone Number is Already Associated with Another Account!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETE ANY EXISTING PHONE CHANGE CODES FOR THIS USER
  await SecurityCode.deleteMany({
    userId,
    purpose: SECURITY_CODE_PURPOSES.PHONE_CHANGE,
  });
  // GENERATING OTP CODE
  const code = generateOtpCode();
  // HASHING OTP CODE BEFORE STORING
  const hashedCode = await bcrypt.hash(code, 10);
  // CREATING SECURITY CODE DOCUMENT
  await SecurityCode.create({
    userId,
    hashedCode,
    purpose: SECURITY_CODE_PURPOSES.PHONE_CHANGE,
    pendingValue: newPhone,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  // SENDING OTP TO CURRENT EMAIL ADDRESS
  await sendPhoneChangeOtp({
    to: user.email,
    fullName: user.fullName,
    code,
    newPhone,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Verification code sent to your email address!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * VERIFY PHONE CHANGE OTP — APPLIES NEW PHONE IF CODE IS VALID
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== VERIFY PHONE CHANGE ==>
export const verifyPhoneChange = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID AND ACCOUNT ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING ACCOUNT ID FOR PROFILE RESPONSE
  const accountId = req.accountId;
  // GETTING OTP CODE FROM REQUEST BODY
  const { code } = req.body;
  // VERIFYING AND CONSUMING THE SECURITY CODE
  const result = await verifyAndConsumeCode(
    userId,
    SECURITY_CODE_PURPOSES.PHONE_CHANGE,
    code,
  );
  // IF VERIFICATION FAILED
  if (!result.success) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: result.error,
      success: false,
      code: result.code,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // APPLYING NEW PHONE NUMBER AND FETCHING ACCOUNT IN PARALLEL
  const [user, account] = await Promise.all([
    User.findByIdAndUpdate(
      userId,
      { phoneNumber: result.pendingValue },
      { new: true },
    )
      .lean()
      .exec(),
    Account.findById(accountId).lean().exec(),
  ]);
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // RETURNING UPDATED PROFILE
  res.status(200).json({
    message: "Phone Number Updated Successfully!",
    success: true,
    data: buildUserProfile(user, account),
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * INITIATE EMAIL CHANGE — VALIDATES NEW EMAIL, SENDS OTP TO CURRENT EMAIL (STEP 1)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== INITIATE EMAIL CHANGE ==>
export const initiateEmailChange = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING NEW EMAIL FROM REQUEST BODY
  const { newEmail } = req.body;
  // NORMALISING NEW EMAIL TO LOWERCASE
  const normalisedEmail = newEmail.toLowerCase().trim();
  // FINDING CURRENT USER
  const user = await User.findById(userId).lean().exec();
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: REJECT IF NEW EMAIL IS THE SAME AS CURRENT
  if (user.email === normalisedEmail) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "New email is the Same as Your Current Email Address!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: CHECK IF EMAIL IS ALREADY TAKEN BY ANOTHER ACCOUNT
  const existingEmail = await User.findOne({
    email: normalisedEmail,
    _id: { $ne: userId },
  })
    .lean()
    .exec();
  // IF EMAIL ALREADY EXISTS
  if (existingEmail) {
    // RETURNING ERROR RESPONSE
    res.status(409).json({
      message: "This Email Address is Already Associated with Another Account!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETE ANY EXISTING EMAIL CHANGE CODES FOR THIS USER (BOTH STAGES)
  await SecurityCode.deleteMany({
    userId,
    purpose: {
      $in: [
        SECURITY_CODE_PURPOSES.EMAIL_CHANGE_CURRENT,
        SECURITY_CODE_PURPOSES.EMAIL_CHANGE_NEW,
      ],
    },
  });
  // GENERATING OTP CODE
  const code = generateOtpCode();
  // HASHING OTP CODE
  const hashedCode = await bcrypt.hash(code, 10);
  // CREATING SECURITY CODE DOCUMENT FOR CURRENT EMAIL VERIFICATION
  await SecurityCode.create({
    userId,
    hashedCode,
    purpose: SECURITY_CODE_PURPOSES.EMAIL_CHANGE_CURRENT,
    pendingValue: normalisedEmail,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  // SENDING OTP TO CURRENT EMAIL FOR IDENTITY VERIFICATION
  await sendEmailChangeCurrentOtp({
    to: user.email,
    fullName: user.fullName,
    code,
    newEmail: normalisedEmail,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Verification code sent to your current email address!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * VERIFY CURRENT EMAIL OTP — STEP 1 OF EMAIL CHANGE — SENDS CODE TO NEW EMAIL (STEP 2)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== VERIFY CURRENT EMAIL FOR CHANGE ==>
export const verifyCurrentEmailForChange = expressAsyncHandler(
  async (req, res) => {
    // GETTING USER ID FROM AUTHENTICATED REQUEST
    const userId = req.id;
    // GETTING OTP CODE FROM REQUEST BODY
    const { code } = req.body;
    // FINDING CURRENT USER
    const user = await User.findById(userId).lean().exec();
    // IF USER NOT FOUND
    if (!user) {
      // RETURNING ERROR RESPONSE
      res.status(404).json({ message: "User Not Found!", success: false });
      // RETURNING FROM FUNCTION
      return;
    }
    // VERIFYING AND CONSUMING THE CURRENT EMAIL SECURITY CODE
    const result = await verifyAndConsumeCode(
      userId,
      SECURITY_CODE_PURPOSES.EMAIL_CHANGE_CURRENT,
      code,
    );
    // IF VERIFICATION FAILED
    if (!result.success) {
      // RETURNING ERROR RESPONSE
      res
        .status(400)
        .json({ message: result.error, success: false, code: result.code });
      // RETURNING FROM FUNCTION
      return;
    }
    // EXTRACTING NEW EMAIL FROM PENDING VALUE
    const newEmail = result.pendingValue;
    // GENERATING SECOND OTP FOR NEW EMAIL VERIFICATION
    const newCode = generateOtpCode();
    // HASHING NEW OTP CODE
    const hashedNewCode = await bcrypt.hash(newCode, 10);
    // CREATING SECURITY CODE DOCUMENT FOR NEW EMAIL VERIFICATION
    await SecurityCode.create({
      userId,
      hashedCode: hashedNewCode,
      purpose: SECURITY_CODE_PURPOSES.EMAIL_CHANGE_NEW,
      pendingValue: newEmail,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    // SENDING VERIFICATION CODE TO THE NEW EMAIL ADDRESS
    await sendEmailChangeNewOtp({
      to: newEmail,
      fullName: user.fullName,
      code: newCode,
    });
    // RETURNING SUCCESS — CLIENT SHOULD NOW SHOW STEP 2 OTP INPUT
    res.status(200).json({
      message:
        "Identity verified! A code has been sent to your new email address.",
      success: true,
    });
    // RETURNING FROM FUNCTION
    return;
  },
);

/**
 * VERIFY NEW EMAIL OTP — STEP 2 OF EMAIL CHANGE — FINALISES EMAIL UPDATE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== VERIFY NEW EMAIL FOR CHANGE ==>
export const verifyNewEmailForChange = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID AND ACCOUNT ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING ACCOUNT ID FOR PROFILE RESPONSE
  const accountId = req.accountId;
  // GETTING OTP CODE FROM REQUEST BODY
  const { code } = req.body;
  // VERIFYING AND CONSUMING THE NEW EMAIL SECURITY CODE
  const result = await verifyAndConsumeCode(
    userId,
    SECURITY_CODE_PURPOSES.EMAIL_CHANGE_NEW,
    code,
  );
  // IF VERIFICATION FAILED
  if (!result.success) {
    // RETURNING ERROR RESPONSE
    res
      .status(400)
      .json({ message: result.error, success: false, code: result.code });
    // RETURNING FROM FUNCTION
    return;
  }
  // APPLYING NEW EMAIL ADDRESS AND FETCHING ACCOUNT IN PARALLEL
  const [user, account] = await Promise.all([
    User.findByIdAndUpdate(
      userId,
      { email: result.pendingValue },
      { new: true },
    )
      .lean()
      .exec(),
    Account.findById(accountId).lean().exec(),
  ]);
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // RETURNING UPDATED PROFILE
  res.status(200).json({
    message: "Email Address Updated Successfully!",
    success: true,
    data: buildUserProfile(user, account),
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * INITIATE PASSWORD CHANGE — PRE-HASHES NEW PASSWORD, SENDS OTP TO CURRENT EMAIL
 * NEW PASSWORD IS STORED HASHED IN SECURITY CODE — NOT SENT WITH VERIFICATION REQUEST
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== INITIATE PASSWORD CHANGE ==>
export const initiatePasswordChange = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING NEW PASSWORD FROM REQUEST BODY
  const { newPassword } = req.body;
  // FINDING CURRENT USER
  const user = await User.findById(userId).lean().exec();
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // PRE-HASHING THE NEW PASSWORD AND STORING IN SECURITY CODE
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  // DELETE ANY EXISTING PASSWORD CHANGE CODES FOR THIS USER
  await SecurityCode.deleteMany({
    userId,
    purpose: SECURITY_CODE_PURPOSES.PASSWORD_CHANGE,
  });
  // GENERATING OTP CODE
  const code = generateOtpCode();
  // HASHING OTP CODE
  const hashedCode = await bcrypt.hash(code, 10);
  // CREATING SECURITY CODE WITH PRE-HASHED NEW PASSWORD AS PENDING VALUE
  await SecurityCode.create({
    userId,
    hashedCode,
    purpose: SECURITY_CODE_PURPOSES.PASSWORD_CHANGE,
    pendingValue: hashedNewPassword,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  // SENDING OTP TO CURRENT EMAIL ADDRESS
  await sendPasswordChangeOtp({
    to: user.email,
    fullName: user.fullName,
    code,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Verification code sent to your email address!",
    success: true,
  });
  return;
});

/**
 * VERIFY PASSWORD CHANGE OTP — APPLIES PRE-HASHED NEW PASSWORD IF CODE IS VALID
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== VERIFY PASSWORD CHANGE ==>
export const verifyPasswordChange = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING OTP CODE FROM REQUEST BODY
  const { code } = req.body;
  // VERIFYING AND CONSUMING THE SECURITY CODE
  const result = await verifyAndConsumeCode(
    userId,
    SECURITY_CODE_PURPOSES.PASSWORD_CHANGE,
    code,
  );
  // IF VERIFICATION FAILED
  if (!result.success) {
    // RETURNING ERROR RESPONSE
    res
      .status(400)
      .json({ message: result.error, success: false, code: result.code });
    // RETURNING FROM FUNCTION
    return;
  }
  // APPLYING THE PRE-HASHED NEW PASSWORD TO THE USER ACCOUNT
  await User.findByIdAndUpdate(userId, { password: result.pendingValue });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Password Changed Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPLOAD OR REPLACE AVATAR — VALIDATES, DELETES OLD IMAGE, UPLOADS TO CLOUDINARY
 * EXPECTS MULTER avatarUpload MIDDLEWARE TO RUN BEFORE THIS HANDLER
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPLOAD AVATAR ==>
export const uploadAvatar = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID AND ACCOUNT ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING ACCOUNT ID FOR PROFILE RESPONSE
  const accountId = req.accountId;
  // GUARD: ENSURE FILE WAS PROVIDED AND PASSED MULTER VALIDATION
  if (!req.file) {
    // RETURNING ERROR RESPONSE
    res
      .status(400)
      .json({ message: "No Image File Provided!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING CURRENT USER TO CHECK FOR EXISTING AVATAR
  const user = await User.findById(userId).lean().exec();
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // IF USER HAS AN EXISTING AVATAR — DELETE IT FROM CLOUDINARY BEFORE UPLOADING NEW ONE
  if (user.avatar?.publicId) {
    // DELETING OLD AVATAR FROM CLOUDINARY — USING PUBLIC ID TO TARGET THE EXACT IMAGE
    await cloudinary.uploader.destroy(user.avatar.publicId).catch(() => {
      // SILENTLY FAIL OLD IMAGE DELETION — NOT CRITICAL IF CLOUDINARY CLEANUP FAILS
      console.warn(
        `Failed to delete old avatar from Cloudinary: ${user.avatar.publicId}`,
      );
    });
  }
  // CONVERTING FILE BUFFER TO DATA URI FOR CLOUDINARY UPLOAD
  const fileDataURI = getDataURI(req.file);
  // UPLOADING NEW AVATAR TO CLOUDINARY AND FETCHING ACCOUNT IN PARALLEL
  const [uploadResult, account] = await Promise.all([
    cloudinary.uploader.upload(fileDataURI.content, {
      // ORGANISING AVATARS INTO A DEDICATED FOLDER
      folder: "MilkShop-Management-System/avatars",
      // OPTIMISING AVATAR QUALITY
      transformation: [
        // CROP TO SQUARE WITH FACE-AWARE GRAVITY
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        // AUTO QUALITY OPTIMISATION
        { quality: "auto:good" },
        // AUTO FORMAT SELECTION (WebP WHERE SUPPORTED)
        { fetch_format: "auto" },
      ],
      // SPECIFYING RESOURCE TYPE AS IMAGE FOR CLOUDINARY OPTIMISATIONS
      resource_type: "image",
    }),
    Account.findById(accountId).lean().exec(),
  ]);
  // UPDATING USER DOCUMENT WITH NEW CLOUDINARY URL AND PUBLIC ID
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      "avatar.url": uploadResult.secure_url,
      "avatar.publicId": uploadResult.public_id,
    },
    { new: true },
  )
    .lean()
    .exec();
  // RETURNING UPDATED PROFILE
  res.status(200).json({
    message: "Avatar Updated Successfully!",
    success: true,
    data: buildUserProfile(updatedUser, account),
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE AVATAR — REMOVES FROM CLOUDINARY AND CLEARS USER AVATAR FIELDS
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE AVATAR ==>
export const deleteAvatar = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID AND ACCOUNT ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING ACCOUNT ID FOR PROFILE RESPONSE
  const accountId = req.accountId;
  // FINDING CURRENT USER
  const user = await User.findById(userId).lean().exec();
  // IF USER NOT FOUND
  if (!user) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "User Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARD: NOTHING TO DELETE IF NO AVATAR IS SET
  if (!user.avatar?.publicId) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({ message: "No Avatar to Delete!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETING AVATAR FROM CLOUDINARY
  await cloudinary.uploader.destroy(user.avatar.publicId);
  // CLEARING AVATAR FIELDS FROM USER DOCUMENT AND FETCHING ACCOUNT IN PARALLEL
  const [updatedUser, account] = await Promise.all([
    User.findByIdAndUpdate(
      userId,
      { "avatar.url": null, "avatar.publicId": null },
      { new: true },
    )
      .lean()
      .exec(),
    Account.findById(accountId).lean().exec(),
  ]);
  // RETURNING UPDATED PROFILE
  res.status(200).json({
    message: "Avatar Removed Successfully!",
    success: true,
    data: buildUserProfile(updatedUser, account),
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE PRICING — UPDATES MILK AND/OR YOGHURT RATES ON THE ACCOUNT DOCUMENT
 * ADMIN-AND-ABOVE ONLY — PRICING IS BUSINESS-WIDE CONFIGURATION, NEVER DELEGABLE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE PRICING ==>
export const updatePricing = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID AND ACCOUNT ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING ACCOUNT ID — PRICING IS ACCOUNT-LEVEL, NOT PER-USER
  const accountId = req.accountId;
  // GETTING RATE VALUES FROM REQUEST BODY
  const { milkRate, yoghurtRate } = req.body;
  // BUILDING PARTIAL UPDATE OBJECT WITH ONLY PROVIDED FIELDS
  const updates = {};
  // VALIDATING AND PARSING MILK RATE IF PROVIDED
  if (milkRate !== undefined) {
    // PARSING MILK RATE AS FLOAT
    const parsedMilkRate = parseFloat(milkRate);
    // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES
    if (!Number.isFinite(parsedMilkRate) || parsedMilkRate <= 0) {
      // RETURNING ERROR RESPONSE
      res.status(400).json({
        message: "Milk Rate must be a Valid Positive Number!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // APPLYING PARSED MILK RATE
    updates.milkRate = parsedMilkRate;
  }
  // VALIDATING AND PARSING YOGHURT RATE IF PROVIDED
  if (yoghurtRate !== undefined) {
    // PARSING YOGHURT RATE AS FLOAT
    const parsedYoghurtRate = parseFloat(yoghurtRate);
    // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES (DEFENSE IN DEPTH)
    if (!Number.isFinite(parsedYoghurtRate) || parsedYoghurtRate <= 0) {
      // RETURNING ERROR RESPONSE
      res.status(400).json({
        message: "Yoghurt Rate must be a Valid Positive Number!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // APPLYING PARSED YOGHURT RATE
    updates.yoghurtRate = parsedYoghurtRate;
  }
  // UPDATING ACCOUNT DOCUMENT WITH NEW RATES AND FETCHING USER IN PARALLEL
  const [account, user] = await Promise.all([
    Account.findByIdAndUpdate(accountId, updates, { new: true }).lean().exec(),
    User.findById(userId).lean().exec(),
  ]);
  // IF ACCOUNT NOT FOUND
  if (!account) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "Account Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // RETURNING UPDATED PROFILE
  res.status(200).json({
    message: "Pricing Updated Successfully!",
    success: true,
    data: buildUserProfile(user, account),
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE REPORT SETTINGS — TOGGLES DAILY AND/OR MONTHLY AUTOMATED REPORTS ON THE ACCOUNT DOCUMENT
 * ADMIN-AND-ABOVE ONLY — REPORT SETTINGS ARE BUSINESS-WIDE CONFIGURATION, NEVER DELEGABLE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE REPORT SETTINGS ==>
export const updateReportSettings = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID AND ACCOUNT ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING ACCOUNT ID — REPORT SETTINGS ARE ACCOUNT-LEVEL, NOT PER-USER
  const accountId = req.accountId;
  // GETTING REPORT TOGGLE VALUES FROM REQUEST BODY
  const { dailyReportsEnabled, monthlyReportsEnabled } = req.body;
  // BUILDING PARTIAL UPDATE OBJECT WITH ONLY PROVIDED FIELDS
  const updates = {};
  // PARSING DAILY REPORTS TO BOOLEAN IF PROVIDED
  if (dailyReportsEnabled !== undefined)
    updates.dailyReportsEnabled = Boolean(dailyReportsEnabled);
  // PARSING MONTHLY REPORTS TO BOOLEAN IF PROVIDED
  if (monthlyReportsEnabled !== undefined)
    updates.monthlyReportsEnabled = Boolean(monthlyReportsEnabled);
  // UPDATING ACCOUNT DOCUMENT WITH NEW REPORT FLAGS AND FETCHING USER IN PARALLEL
  const [account, user] = await Promise.all([
    Account.findByIdAndUpdate(accountId, updates, { new: true }).lean().exec(),
    User.findById(userId).lean().exec(),
  ]);
  // IF ACCOUNT NOT FOUND
  if (!account) {
    // RETURNING ERROR RESPONSE
    res.status(404).json({ message: "Account Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // RETURNING UPDATED PROFILE
  res.status(200).json({
    message: "Report Settings Updated Successfully!",
    success: true,
    data: buildUserProfile(user, account),
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * CANCEL PENDING SECURITY CODE — CLEANS UP WHEN USER ABANDONS A CHANGE FLOW
 * EMAIL CHANGE CANCELLATION REMOVES BOTH STAGE 1 AND STAGE 2 CODES
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== CANCEL SECURITY CODE ==>
export const cancelSecurityCode = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING PURPOSE FROM URL PARAMS
  const { purpose } = req.params;
  // FOR EMAIL CHANGE — DELETE BOTH STAGE 1 AND STAGE 2 CODES
  if (
    purpose === SECURITY_CODE_PURPOSES.EMAIL_CHANGE_CURRENT ||
    purpose === SECURITY_CODE_PURPOSES.EMAIL_CHANGE_NEW
  ) {
    // DELETING ALL EMAIL CHANGE CODES FOR THIS USER TO CANCEL THE ENTIRE EMAIL CHANGE PROCESS
    await SecurityCode.deleteMany({
      userId,
      purpose: {
        $in: [
          SECURITY_CODE_PURPOSES.EMAIL_CHANGE_CURRENT,
          SECURITY_CODE_PURPOSES.EMAIL_CHANGE_NEW,
        ],
      },
    });
  } else {
    // FOR OTHER PURPOSES — DELETE ONLY THE SPECIFIC PURPOSE CODE
    await SecurityCode.deleteMany({ userId, purpose });
  }
  // RETURNING SUCCESS
  res.status(200).json({
    message: "Pending verification cancelled.",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * INITIATE FORGOT PASSWORD — FINDS USER BY EMAIL, GENERATES OTP, SENDS TO THEIR EMAIL
 * THIS IS A PUBLIC ENDPOINT — NO isAuthenticated MIDDLEWARE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== INITIATE FORGOT PASSWORD ==>
export const initiateForgotPassword = expressAsyncHandler(async (req, res) => {
  // GETTING EMAIL FROM REQUEST BODY
  const { email } = req.body;
  // FINDING USER BY EMAIL — NORMALISED TO LOWERCASE BY VALIDATOR
  const user = await User.findOne({ email }).lean().exec();
  // IF USER NOT FOUND — RETURN GENERIC SUCCESS TO PREVENT EMAIL ENUMERATION
  if (!user) {
    // RETURNING GENERIC SUCCESS RESPONSE WITHOUT REVEALING USER EXISTENCE
    res.status(200).json({
      message:
        "If an account with that email exists, a verification code has been sent.",
      success: true,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETE ANY EXISTING FORGOT PASSWORD CODES FOR THIS USER BEFORE CREATING NEW ONE
  await SecurityCode.deleteMany({
    userId: user._id,
    purpose: {
      $in: [
        SECURITY_CODE_PURPOSES.FORGOT_PASSWORD_OTP,
        SECURITY_CODE_PURPOSES.FORGOT_PASSWORD_RESET,
      ],
    },
  });
  // GENERATING 6-DIGIT OTP CODE
  const code = generateOtpCode();
  // HASHING OTP CODE BEFORE STORING
  const hashedCode = await bcrypt.hash(code, 10);
  // CREATING SECURITY CODE DOCUMENT FOR FORGOT PASSWORD OTP VERIFICATION
  await SecurityCode.create({
    userId: user._id,
    hashedCode,
    purpose: SECURITY_CODE_PURPOSES.FORGOT_PASSWORD_OTP,
    // STORING USER EMAIL AS PENDING VALUE FOR REFERENCE IN SUBSEQUENT STEPS
    pendingValue: user.email,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  // SENDING FORGOT PASSWORD OTP TO USER'S REGISTERED EMAIL ADDRESS
  await sendForgotPasswordOtp({
    to: user.email,
    fullName: user.fullName,
    code,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message:
      "If an account with that email exists, a verification code has been sent.",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * VERIFY FORGOT PASSWORD OTP — VALIDATES CODE, CREATES SHORT-LIVED RESET PERMISSION TOKEN
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== VERIFY FORGOT PASSWORD OTP ==>
export const verifyForgotPasswordOtp = expressAsyncHandler(async (req, res) => {
  // GETTING EMAIL AND OTP CODE FROM REQUEST BODY
  const { email, code } = req.body;
  // FINDING USER BY EMAIL TO GET THEIR USER ID FOR SECURITY CODE LOOKUP
  const user = await User.findOne({ email }).lean().exec();
  // IF USER NOT FOUND — RETURN GENERIC INVALID CODE ERROR
  if (!user) {
    // RETURNING GENERIC ERROR TO PREVENT EMAIL ENUMERATION
    res
      .status(400)
      .json({ message: "Invalid or expired code.", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // VERIFYING AND CONSUMING THE FORGOT PASSWORD OTP SECURITY CODE
  const result = await verifyAndConsumeCode(
    user._id,
    SECURITY_CODE_PURPOSES.FORGOT_PASSWORD_OTP,
    code,
  );
  // IF OTP VERIFICATION FAILED — RETURN ERROR WITH REMAINING ATTEMPTS INFO
  if (!result.success) {
    // RETURNING ERROR RESPONSE FROM VERIFY AND CONSUME CODE HELPER
    res
      .status(400)
      .json({ message: result.error, success: false, code: result.code });
    // RETURNING FROM FUNCTION
    return;
  }
  // OTP VERIFIED — CREATING A SHORT-LIVED RESET PERMISSION TOKEN
  const resetPermissionToken =
    Math.random().toString(36).slice(2) + Date.now().toString(36);
  // HASHING RESET PERMISSION TOKEN BEFORE STORING (REQUIRED BY SCHEMA)
  const hashedResetToken = await bcrypt.hash(resetPermissionToken, 10);
  // CREATING RESET PERMISSION SECURITY CODE — EXPIRES IN 15 MINUTES
  await SecurityCode.create({
    userId: user._id,
    hashedCode: hashedResetToken,
    purpose: SECURITY_CODE_PURPOSES.FORGOT_PASSWORD_RESET,
    pendingValue: user.email,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  // RETURNING SUCCESS — CLIENT SHOULD NOW SHOW NEW PASSWORD FORM
  res.status(200).json({
    message: "Code verified! You can now set your new password.",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * RESET FORGOT PASSWORD — FINDS RESET PERMISSION TOKEN, APPLIES NEW PASSWORD
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== RESET FORGOT PASSWORD ==>
export const resetForgotPassword = expressAsyncHandler(async (req, res) => {
  // GETTING EMAIL AND NEW PASSWORD FROM REQUEST BODY
  const { email, newPassword } = req.body;
  // FINDING USER BY EMAIL
  const user = await User.findOne({ email }).lean().exec();
  // IF USER NOT FOUND — RETURN GENERIC UNAUTHORISED ERROR
  if (!user) {
    // RETURNING UNAUTHORISED ERROR — CANNOT RESET FOR NON-EXISTENT USER
    res.status(400).json({
      message:
        "Password reset session not found or expired. Please start again.",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING FOR A VALID RESET PERMISSION TOKEN FOR THIS USER
  const resetCode = await SecurityCode.findOne({
    userId: user._id,
    purpose: SECURITY_CODE_PURPOSES.FORGOT_PASSWORD_RESET,
    used: false,
    expiresAt: { $gt: new Date() },
  })
    .lean()
    .exec();
  // IF NO VALID RESET PERMISSION TOKEN EXISTS — SESSION EXPIRED OR NOT VERIFIED
  if (!resetCode) {
    // RETURNING SESSION EXPIRED ERROR
    res.status(400).json({
      message:
        "Password reset session not found or expired. Please start again.",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // HASHING THE NEW PASSWORD BEFORE APPLYING TO THE USER ACCOUNT
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  // APPLYING NEW PASSWORD AND CONSUMING RESET TOKEN IN PARALLEL
  await Promise.all([
    User.findByIdAndUpdate(user._id, { password: hashedNewPassword }),
    SecurityCode.updateOne({ _id: resetCode._id }, { used: true }),
  ]);
  // RETURNING SUCCESS RESPONSE — CLIENT SHOULD NAVIGATE TO LOGIN
  res.status(200).json({
    message:
      "Password reset successfully! You can now log in with your new password.",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * CANCEL FORGOT PASSWORD — CLEANS UP ALL FORGOT PASSWORD CODES FOR THE USER
 * IDEMPOTENT — RETURNS SUCCESS EVEN IF NO CODES EXIST OR USER NOT FOUND
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== CANCEL FORGOT PASSWORD ==>
export const cancelForgotPassword = expressAsyncHandler(async (req, res) => {
  // GETTING EMAIL FROM REQUEST BODY
  const { email } = req.body;
  // FINDING USER BY EMAIL — SILENTLY SKIP DELETION IF USER NOT FOUND
  const user = await User.findOne({ email }).lean().exec();
  // IF USER EXISTS — DELETE ALL THEIR FORGOT PASSWORD CODES
  if (user) {
    // DELETING BOTH OTP AND RESET PERMISSION CODES FOR THIS USER
    await SecurityCode.deleteMany({
      userId: user._id,
      purpose: {
        $in: [
          SECURITY_CODE_PURPOSES.FORGOT_PASSWORD_OTP,
          SECURITY_CODE_PURPOSES.FORGOT_PASSWORD_RESET,
        ],
      },
    });
  }
  // RETURNING SUCCESS — IDEMPOTENT REGARDLESS OF WHETHER CODES EXISTED
  res.status(200).json({
    message: "Forgot password request cancelled.",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
