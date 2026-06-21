// <== IMPORTS ==>
import "../env.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import readline from "readline/promises";
import connectDB from "../config/dbConnection.js";
import { Account } from "../models/account.model.js";
import { User, USER_ROLES } from "../models/user.model.js";

// <== PROMPT INTERFACE ==>
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// <== HELPER: VALIDATE EMAIL FORMAT ==>
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// <== HELPER: VALIDATE PASSWORD STRENGTH ==>
const isValidPassword = (password) =>
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

/**
 * CREATE SUPERADMIN
 * STANDALONE OPERATOR SCRIPT — RUN LOCALLY, NEVER EXPOSED AS AN HTTP ROUTE
 * @returns {Promise<void>}
 */
// <== CREATE SUPERADMIN ==>
const createSuperadmin = async () => {
  try {
    // CONNECTING TO THE DATABASE — REUSES THE SAME CONNECTION HELPER AS THE MAIN SERVER
    await connectDB();
    // WAITING FOR THE MONGOOSE CONNECTION TO BE FULLY OPEN BEFORE PROCEEDING
    await new Promise((resolve) => mongoose.connection.once("open", resolve));
    // LOGGING CONNECTION SUCCESS
    console.log("Database Connection Established Successfully\n");
    // PROMPTING FOR BUSINESS NAME
    const businessName = (await rl.question("Business Name: ")).trim();
    // IF BUSINESS NAME IS EMPTY, ABORT
    if (!businessName) {
      // LOGGING ERROR AND ABORTING
      throw new Error("Business Name is Required!");
    }
    // PROMPTING FOR SUPERADMIN FULL NAME
    const fullName = (await rl.question("Superadmin Full Name: ")).trim();
    // IF FULL NAME IS EMPTY, ABORT
    if (!fullName) {
      // LOGGING ERROR AND ABORTING
      throw new Error("Full Name is Required!");
    }
    // PROMPTING FOR SUPERADMIN EMAIL
    const email = (await rl.question("Superadmin Email: "))
      .trim()
      .toLowerCase();
    // VALIDATING EMAIL FORMAT
    if (!isValidEmail(email)) {
      // LOGGING ERROR AND ABORTING
      throw new Error("Please Provide a Valid Email Address!");
    }
    // CHECKING IF A USER WITH THIS EMAIL ALREADY EXISTS
    const existingUser = await User.findOne({ email }).lean().exec();
    // IF USER ALREADY EXISTS, ABORT
    if (existingUser) {
      // LOGGING ERROR AND ABORTING
      throw new Error("A User with this Email Already Exists!");
    }
    // PROMPTING FOR SUPERADMIN PASSWORD (UNMASKED — THIS IS A LOCAL OPERATOR-ONLY SCRIPT)
    const password = await rl.question(
      "Superadmin Password (min 8 chars, upper, lower, digit, special char): ",
    );
    // VALIDATING PASSWORD STRENGTH
    if (!isValidPassword(password)) {
      // LOGGING ERROR AND ABORTING
      throw new Error(
        "Password must be at least 8 Characters and Contain Uppercase, Lowercase, a Digit, and a Special Character!",
      );
    }
    // CREATING THE ACCOUNT DOCUMENT
    const account = await Account.create({ businessName });
    // HASHING THE SUPERADMIN PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);
    // CREATING THE SUPERADMIN USER DOCUMENT
    const superadmin = await User.create({
      accountId: account._id,
      role: USER_ROLES.SUPERADMIN,
      fullName,
      email,
      password: hashedPassword,
      isActive: true,
      hasSetPassword: true,
      createdBy: null,
    });
    // LOGGING SUCCESS MESSAGE
    console.log("\nSuperadmin Created Successfully!");
    // LOGGING ACCOUNT ID OF THE CREATED SUPERADMIN
    console.log(`Account ID:    ${account._id}`);
    // LOGGING USER ID AND EMAIL OF THE CREATED SUPERADMIN
    console.log(`Superadmin ID: ${superadmin._id}`);
    // LOGGING THE EMAIL OF THE CREATED SUPERADMIN
    console.log(`Email:         ${superadmin.email}`);
  } catch (error) {
    // LOGGING ERROR AND EXITING WITH FAILURE CODE
    console.error(`\nFailed to Create Superadmin: ${error.message}`);
    // SETTING EXIT CODE TO 1 TO INDICATE FAILURE
    process.exitCode = 1;
  } finally {
    // CLOSING THE PROMPT INTERFACE
    rl.close();
    // DISCONNECTING FROM THE DATABASE
    await mongoose.disconnect();
  }
};

// <== RUNNING THE SCRIPT ==>
createSuperadmin();
