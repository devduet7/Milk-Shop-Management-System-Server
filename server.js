// <== IMPORTS ==>
import "./env.js";
import path from "path";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import rootRoute from "./routes/root.route.js";
import userRoutes from "./routes/user.route.js";
import connectDB from "./config/dbConnection.js";
import corsOptions from "./config/corsOptions.js";
import { logEvents } from "./middleware/logger.js";
import { getDirName } from "./utils/getDirName.js";
import { app, server } from "./services/socket.js";
import { errorHandler } from "./middleware/errorHandler.js";
import helmetMiddleware from "./middleware/helmetMiddleware.js";

// <== DATABASE CONNECTION ==>
connectDB();

// <== DIRNAME ==>
const __dirname = getDirName(import.meta.url);

// <== PORT ==>
const PORT = process.env.PORT || 3000;

// <== MIDDLEWARE> ==>
// CORS MIDDLEWARE
app.use(cors(corsOptions));
// JSON MIDDLEWARE
app.use(express.json());
// FORM DATA MIDDLEWARE
app.use(express.urlencoded({ extended: true }));
// COOKIE PARSER MIDDLEWARE
app.use(cookieParser());
// HELMET MIDDLEWARE
app.use(helmetMiddleware());
// STATIC MIDDLEWARE
app.use("/", express.static(path.join(__dirname, "public")));

// <== ROUTES MIDDLEWARE ==>
// ROOT ROUTE
app.use("/", rootRoute);
// USER ROUTE
app.use("/api/v1/user", userRoutes);

// <== MIDDLEWARE 404 RESPONSE ==>
app.all("*", (req, res) => {
  // SETTING STATUS
  res.status(404);
  // RESPONSE HANDLING
  if (req.accepts("html")) {
    // HTML RESPONSE
    res.sendFile(path.join(__dirname, "views", "404.html"));
  } else if (req.accepts("json")) {
    // JSON RESPONSE
    res.json({ message: "404 : Page Not Found" });
  } else {
    // TEXT RESPONSE
    res.type("txt").send("404 : Page Not Found");
  }
});

// <== ERROR HANDLER ==>
app.use(errorHandler);

// <== DATABASE & SERVER CONNECTION LISTENER ==>
mongoose.connection.once("open", () => {
  // CONNECTING DATABASE
  console.log("Database Connection Established Successfully");
  // CONNECTING SERVER
  server.listen(PORT, () => {
    // LOGGING SERVER CONNECTION
    console.log(`Server is running on port ${PORT}`);
  });
});

// <== DATABASE CONNECTION ERROR LISTENER ==>
mongoose.connection.on("error", (err) => {
  // DATABASE DISCONNECTION ERROR
  console.log(err);
  // LOGGING DATABASE CONNECTION ERRORS
  logEvents(
    `${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`,
    "mongoErrLog.log",
  );
});

// <== DATABASE CONNECTION DISCONNECTION LISTENER ==>
mongoose.connection.on("disconnected", () => {
  // DISCONNECTING DATABASE
  console.log("Database Connection Disconnected");
});
