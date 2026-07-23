// <== IMPORTS ==>
import rateLimit from "express-rate-limit";

// <== KEY GENERATOR: AUTHENTICATED USER ID ==>
const byUser = (req) => req.id;

// <== KEY GENERATOR: AUTHENTICATED USER'S ACCOUNT ID ==>
const byAccount = (req) => req.accountId;

// <== GLOBAL RATE LIMITER — IP-BASED BACKSTOP ACROSS EVERY REQUEST ==>
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too Many Requests. Please try again shortly.",
  },
});

// <== LOGIN LIMITER — IP-BASED, STRICT, ONLY FAILED ATTEMPTS COUNT TOWARD THE LIMIT ==>
export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too Many Login Attempts. Please try again after 10 Minutes.",
  },
});

// <== TOKEN REFRESH LIMITER — IP-BASED, RUNS BEFORE AUTH IS ESTABLISHED ==>
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too Many Requests. Please try again shortly.",
  },
});

// <== FORGOT PASSWORD LIMITER — IP-BASED, STRICT, SHARED ACROSS INITIATE/VERIFY/RESET/CANCEL ==>
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too Many Attempts. Please try again after 15 Minutes.",
  },
});

// <== ACCOUNT SETUP LIMITER — IP-BASED, STRICT, PUBLIC ENDPOINT FOR INVITED USERS ==>
export const accountSetupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too Many Attempts. Please try again after 15 Minutes.",
  },
});

// <== SECURITY CODE LIMITER — PER-USER, SHARED ACROSS VERIFY/RESET/CANCEL ==>
export const securityCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUser,
  message: {
    success: false,
    message: "Too Many Attempts. Please try again after 15 Minutes.",
  },
});

// <== AVATAR UPLOAD LIMITER — PER-USER, PROTECTS CLOUDINARY USAGE ==>
export const avatarUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUser,
  message: {
    success: false,
    message: "Too Many Avatar Uploads. Please try again in an Hour.",
  },
});

// <== TEAM INVITE LIMITER — PER-ACCOUNT, SHARED ACROSS INVITE + RESEND INVITE ==>
export const teamInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byAccount,
  message: {
    success: false,
    message: "Too Many Invite Requests. Please try again in an Hour.",
  },
});
