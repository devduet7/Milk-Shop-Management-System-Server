// <== IMPORTS ==>
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { Session } from "../models/session.model.js";
import allowedOrigins from "../config/allowedOrigins.js";

// <== CREATING APP INSTANCE ==>
const app = express();

// <== CREATING SERVER ==>
const server = http.createServer(app);

// <== SOCKET SERVER INSTANCE ==>
const io = new Server(server, {
  // ALLOWING CORS FOR SOCKET CONNECTIONS
  cors: {
    // ALLOWED ORIGIN FOR SOCKET CONNECTIONS
    origin: (origin, callback) => {
      // CHECKING IF THE ORIGIN IS ALLOWED
      if (allowedOrigins.includes(origin) || !origin) {
        // ALLOWING THE ORIGIN
        callback(null, true);
      } else {
        // DENYING THE ORIGIN
        callback(new Error("Not Allowed by CORS"));
      }
    },
    // ALLOWING THE FOLLOWING HTTP VERBS
    methods: ["GET", "POST", "PUT", "DELETE"],
    // CREDENTIALS MUST BE ALLOWED FOR THE HANDSHAKE
    credentials: true,
  },
});

// <== PARSING COOKIE HEADER ==>
const parseCookies = (cookieHeader) => {
  // GUARD: NO COOKIE HEADER ON THE HANDSHAKE
  if (!cookieHeader) return {};
  // BUILDING THE COOKIE MAP
  return cookieHeader.split(";").reduce((acc, pair) => {
    // SPLITTING EACH "KEY=VALUE" PAIR
    const [key, ...valueParts] = pair.trim().split("=");
    // GUARD: MALFORMED PAIR
    if (!key) return acc;
    // DECODING AND STORING THE VALUE
    acc[key] = decodeURIComponent(valueParts.join("="));
    // RETURNING ACCUMULATOR
    return acc;
  }, {});
};

/**
 * SOCKET AUTH MIDDLEWARE
 * VALIDATES THE ACCESS TOKEN'S SIGNATURE/CLAIMS
 */
// <== SOCKET AUTH MIDDLEWARE ==>
io.use(async (socket, next) => {
  // PARSING COOKIES FROM THE HANDSHAKE HEADERS
  const cookies = parseCookies(socket.handshake.headers.cookie);
  // EXTRACTING THE ACCESS TOKEN COOKIE
  const accessToken = cookies.accessToken;
  // EXTRACTING THE REFRESH TOKEN COOKIE — CARRIES THE SESSION ID
  const refreshTokenCookie = cookies.refreshToken;
  // IF EITHER COOKIE IS MISSING, THERE IS NOTHING TO AUTHENTICATE
  if (!accessToken || !refreshTokenCookie) {
    // REJECTING THE HANDSHAKE
    return next(new Error("Unauthorized"));
  }
  // DECODED ACCESS TOKEN PAYLOAD
  let decodedAccess;
  //  TRYING TO VERIFY THE ACCESS TOKEN
  try {
    // VERIFYING THE ACCESS TOKEN SIGNATURE
    decodedAccess = jwt.verify(accessToken, process.env.AT_SECRET, {
      ignoreExpiration: true,
    });
    // GUARD: PAYLOAD MISSING REQUIRED CLAIMS
    if (
      !decodedAccess.userId ||
      !decodedAccess.accountId ||
      !decodedAccess.role
    ) {
      // REJECTING THE HANDSHAKE
      return next(new Error("Unauthorized"));
    }
  } catch {
    // SIGNATURE INVALID OR TOKEN OTHERWISE UNUSABLE
    return next(new Error("Unauthorized"));
  }
  // DECODED REFRESH TOKEN PAYLOAD
  let decodedRefresh;
  // TRYING TO VERIFY THE REFRESH TOKEN
  try {
    // VERIFYING THE REFRESH TOKEN SIGNATURE
    decodedRefresh = jwt.verify(refreshTokenCookie, process.env.RT_SECRET, {
      ignoreExpiration: true,
    });
    // GUARD: NO SESSION ID EMBEDDED
    if (!decodedRefresh.sessionId) {
      // REJECTING THE HANDSHAKE
      return next(new Error("Unauthorized"));
    }
  } catch {
    // SIGNATURE INVALID OR TOKEN OTHERWISE UNUSABLE
    return next(new Error("Unauthorized"));
  }
  // FETCHING THE SESSION THIS SOCKET CLAIMS TO BELONG TO
  const session = await Session.findById(decodedRefresh.sessionId)
    .select("isActive userId")
    .lean()
    .exec();
  // GUARD: SESSION DELETED, ALREADY REVOKED, OR BELONGS TO A DIFFERENT USER
  if (
    !session ||
    !session.isActive ||
    session.userId.toString() !== decodedAccess.userId
  ) {
    // REJECTING WITH A DISTINGUISHABLE CODE
    return next(new Error("SESSION_REVOKED"));
  }
  // ATTACHING USER ID TO SOCKET TO USE IN CONNECTION HANDLER
  socket.userId = decodedAccess.userId;
  // ATTACHING ACCOUNT ID TO SOCKET TO USE IN CONNECTION HANDLER
  socket.accountId = decodedAccess.accountId;
  // ATTACHING ROLE TO SOCKET TO USE IN CONNECTION HANDLER
  socket.role = decodedAccess.role;
  // ATTACHING SESSION ID TO SOCKET — LETS THE CLIENT LEARN ITS OWN SESSION IDENTITY
  socket.sessionId = decodedRefresh.sessionId;
  // ALLOWING THE CONNECTION
  next();
});

// <== CONNECTION HANDLER ==>
io.on("connection", (socket) => {
  // EVERY AUTHENTICATED SOCKET JOINS ITS OWN USER ROOM
  socket.join(`user:${socket.userId}`);
  // ADMIN-TIER SOCKETS ADDITIONALLY JOIN THEIR ACCOUNT'S ADMIN ROOM
  if (socket.role === "superadmin" || socket.role === "admin") {
    // JOINING THE ACCOUNT-WIDE ADMIN ROOM
    socket.join(`account:${socket.accountId}`);
  }
  // TELLING THE CLIENT WHICH SESSION THIS CONNECTION BELONGS TO — LETS IT FILTER
  socket.emit("session:identity", { sessionId: socket.sessionId });
});

/**
 * EMIT AN EVENT TO ALL OF A SPECIFIC USER'S CONNECTED SOCKETS (E.G. MULTIPLE OPEN TABS)
 * BEST-EFFORT — SOCKET EMIT FAILURES ARE NEVER ALLOWED TO THROW OUT OF A CONTROLLER
 * @param {string} userId - THE TARGET USER'S ID
 * @param {string} event - THE EVENT NAME
 * @param {object} payload - THE EVENT PAYLOAD
 * @returns {void}
 */
// <== EMIT TO USER ==>
export const emitToUser = (userId, event, payload) => {
  // GUARD: NO USER ID
  if (!userId) {
    // LOGGING BUT NEVER THROWING — A SOCKET FAILURE MUST NEVER BREAK AN HTTP REQUEST
    console.error(
      `[SOCKET] Failed to Emit "${event}" to User:${userId}`,
      new Error("Invalid User ID"),
    );
    // RETURNING WITHOUT EMITTING
    return;
  }
  try {
    // EMITTING TO THE USER'S PERSONAL ROOM
    io.to(`user:${userId}`).emit(event, payload);
  } catch (err) {
    // LOGGING BUT NEVER THROWING — A SOCKET FAILURE MUST NEVER BREAK AN HTTP REQUEST
    console.error(`[SOCKET] Failed to Emit "${event}" to User:${userId}`, err);
  }
};

/**
 * EMIT AN EVENT TO ALL ADMIN-TIER SOCKETS WATCHING A GIVEN ACCOUNT (SUPERADMIN AND ADMIN ONLY)
 * @param {string} accountId - THE TARGET ACCOUNT'S ID
 * @param {string} event - THE EVENT NAME
 * @param {object} payload - THE EVENT PAYLOAD
 * @returns {void}
 */
// <== EMIT TO ACCOUNT ADMINS ==>
export const emitToAccountAdmins = (accountId, event, payload) => {
  // GUARD: NO ACCOUNT ID
  if (!accountId) {
    // LOGGING BUT NEVER THROWING
    console.error(
      `[SOCKET] Failed to Emit "${event}" to Account:${accountId}`,
      new Error("Invalid Account ID"),
    );
    // RETURNING WITHOUT EMITTING
    return;
  }
  try {
    // EMITTING TO THE ACCOUNT'S ADMIN ROOM
    io.to(`account:${accountId}`).emit(event, payload);
  } catch (err) {
    // LOGGING BUT NEVER THROWING
    console.error(
      `[SOCKET] Failed to Emit "${event}" to Account:${accountId}`,
      err,
    );
  }
};

// <== EXPORTING THE APP, SERVER, AND IO INSTANCE ==>
export { app, server, io };
