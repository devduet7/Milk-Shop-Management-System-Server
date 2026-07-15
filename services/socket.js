// <== IMPORTS ==>
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
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

// <== SOCKET AUTH MIDDLEWARE ==>
io.use((socket, next) => {
  // PARSING COOKIES FROM THE HANDSHAKE HEADERS
  const cookies = parseCookies(socket.handshake.headers.cookie);
  // EXTRACTING THE ACCESS TOKEN COOKIE
  const accessToken = cookies.accessToken;
  // IF NO ACCESS TOKEN IS PRESENT, REJECT THE CONNECTION
  if (!accessToken) {
    // REJECTING THE HANDSHAKE
    return next(new Error("Unauthorized"));
  }
  // VERIFYING THE ACCESS TOKEN
  try {
    // VERIFYING THE ACCESS TOKEN SIGNATURE
    const decoded = jwt.verify(accessToken, process.env.AT_SECRET, {
      ignoreExpiration: true,
    });
    // GUARD: PAYLOAD MISSING REQUIRED CLAIMS
    if (!decoded.userId || !decoded.accountId || !decoded.role) {
      // REJECTING THE HANDSHAKE
      return next(new Error("Unauthorized"));
    }
    // ATTACHING USER ID TO SOCKET TO USE IN CONNECTION HANDLER
    socket.userId = decoded.userId;
    // ATTACHING ACCOUNT ID TO SOCKET TO USE IN CONNECTION HANDLER
    socket.accountId = decoded.accountId;
    // ATTACHING ROLE TO SOCKET TO USE IN CONNECTION HANDLER
    socket.role = decoded.role;
    // ALLOWING THE CONNECTION
    next();
  } catch {
    // SIGNATURE INVALID OR TOKEN OTHERWISE UNUSABLE
    next(new Error("Unauthorized"));
  }
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
