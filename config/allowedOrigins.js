// <== IMPORTS ==>
import { env } from "./env.js";

// <== CLIENT URL CONFIGURATION ==>
const clientUrl = env.CLIENT_URL;

// <== ALLOWED ORIGINS FOR CORS ==>
const allowedOrigins = clientUrl
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

// <== EXPORTING ALLOWED ORIGINS ==>
export default allowedOrigins;
