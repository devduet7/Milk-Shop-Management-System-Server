// <== IMPORTS ==>
import { v2 as cloudinary } from "cloudinary";

// <== CONFIGURING CLOUDINARY ==>
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// <== EXPORTING CLOUDINARY ==>
export default cloudinary;
