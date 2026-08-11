// <== IMPORTS ==>
import path from "path";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import cookieParser from "cookie-parser";
import rootRoute from "./routes/root.route.js";
import saleRoutes from "./routes/sale.route.js";
import userRoutes from "./routes/user.route.js";
import connectDB from "./config/dbConnection.js";
import staffRoutes from "./routes/staff.route.js";
import corsOptions from "./config/corsOptions.js";
import trashRoutes from "./routes/trash.route.js";
import { logEvents } from "./middleware/logger.js";
import { getDirName } from "./utils/getDirName.js";
import { app, server } from "./services/socket.js";
import sessionRoutes from "./routes/session.route.js";
import milkLogRoutes from "./routes/milkLog.route.js";
import teamUserRoutes from "./routes/teamUser.route.js";
import settingsRoutes from "./routes/settings.route.js";
import recoveryRoutes from "./routes/recovery.route.js";
import customerRoutes from "./routes/customer.route.js";
import purchaseRoutes from "./routes/purchase.route.js";
import analyticsRoutes from "./routes/analytics.route.js";
import quickSaleRoutes from "./routes/quickSale.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { initializeCronJobs } from "./services/cronJobs.js";
import expenditureRoutes from "./routes/expenditure.route.js";
import helmetMiddleware from "./middleware/helmetMiddleware.js";

// <== DATABASE CONNECTION ==>
connectDB();

// <== DIRNAME ==>
const __dirname = getDirName(import.meta.url);

// <== PORT ==>
const PORT = env.PORT;

// <== MIDDLEWARE> ==>
// CORS MIDDLEWARE
app.use(cors(corsOptions));
// TRUST PROXY MIDDLEWARE
app.set("trust proxy", 1);
// GLOBAL RATE LIMITER MIDDLEWARE
app.use(globalLimiter);
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
// SALE ROUTE
app.use("/api/v1/sales", saleRoutes);
// STAFF ROUTE
app.use("/api/v1/staff", staffRoutes);
// TRASH ROUTE
app.use("/api/v1/trash", trashRoutes);
// TEAM USER MANAGEMENT ROUTE
app.use("/api/v1/users", teamUserRoutes);
// SESSION MANAGEMENT ROUTE
app.use("/api/v1/sessions", sessionRoutes);
// MILK LOG ROUTE
app.use("/api/v1/milk-logs", milkLogRoutes);
// SETTINGS ROUTE
app.use("/api/v1/settings", settingsRoutes);
// PURCHASE ROUTE
app.use("/api/v1/purchases", purchaseRoutes);
// CUSTOMER ROUTE
app.use("/api/v1/customers", customerRoutes);
// RECOVERY ROUTE
app.use("/api/v1/recoveries", recoveryRoutes);
// DASHBOARD ROUTE
app.use("/api/v1/dashboard", dashboardRoutes);
// ANALYTICS ROUTE
app.use("/api/v1/analytics", analyticsRoutes);
// QUICK SALE ROUTE
app.use("/api/v1/quick-sales", quickSaleRoutes);
// EXPENDITURE ROUTE
app.use("/api/v1/expenditures", expenditureRoutes);

// <== HEALTH CHECK ROUTE ==>
app.get("/health", (_req, res) => {
  // CHECKING THE DATABASE CONNECTION STATE
  const dbState = mongoose.connection.readyState;
  // IF DATABASE IS CONNECTED
  if (dbState === 1) {
    // RESPONDING WITH HEALTHY STATUS
    res.status(200).json({ status: "Server is Healthy and Running 🤍" });
  } else {
    // RESPONDING WITH UNHEALTHY STATUS
    res.status(503).json({ status: "Database Unavailable", dbState });
  }
});

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
    // INITIALIZING CRON JOBS
    initializeCronJobs();
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
