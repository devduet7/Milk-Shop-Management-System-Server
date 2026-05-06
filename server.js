// <== IMPORTS ==>
import "./env.js";
import path from "path";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import rootRoute from "./routes/root.route.js";
import saleRoutes from "./routes/sale.route.js";
import userRoutes from "./routes/user.route.js";
import connectDB from "./config/dbConnection.js";
import staffRoutes from "./routes/staff.route.js";
import corsOptions from "./config/corsOptions.js";
import { logEvents } from "./middleware/logger.js";
import { getDirName } from "./utils/getDirName.js";
import { app, server } from "./services/socket.js";
import settingsRoutes from "./routes/settings.route.js";
import recoveryRoutes from "./routes/recovery.route.js";
import customerRoutes from "./routes/customer.route.js";
import purchaseRoutes from "./routes/purchase.route.js";
import quickSaleRoutes from "./routes/quickSale.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import { errorHandler } from "./middleware/errorHandler.js";
import expenditureRoutes from "./routes/expenditure.route.js";
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
// SALE ROUTE
app.use("/api/v1/sales", saleRoutes);
// STAFF ROUTE
app.use("/api/v1/staff", staffRoutes);
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
// QUICK SALE ROUTE
app.use("/api/v1/quick-sales", quickSaleRoutes);
// EXPENDITURE ROUTE
app.use("/api/v1/expenditures", expenditureRoutes);

// <== HEALTH CHECK ROUTE ==>
app.get("/health", (_req, res) => {
  // HEALTH CHECK RESPONSE
  res.status(200).json({ status: "Server is Healthy and Running 🤍" });
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
