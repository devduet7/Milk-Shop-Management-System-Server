// <== IMPORTS ==>
import { env } from "../config/env.js";
import { v2 as cloudinary } from "cloudinary";

// <== CONFIGURING CLOUDINARY ==>
cloudinary.config({
  cloud_name: env.CLOUD_NAME,
  api_key: env.API_KEY,
  api_secret: env.API_SECRET,
});

// <== EXPORTING CLOUDINARY ==>
export default cloudinary;
