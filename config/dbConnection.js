// <== IMPORTS ==>
import { env } from "./env.js";
import mongoose from "mongoose";

// <== CONNECTING DATABASE ==>
const connectDB = async () => {
  // CONNECTING DATABASE
  try {
    // CONNECTING DATABASE
    await mongoose.connect(env.MONGO_URI);
  } catch (err) {
    // CATCHING ERROR
    console.log(err);
  }
};

// <== EXPORTING DATABASE CONNECTION FUNCTION ==>
export default connectDB;
