// <== CLIENT URL CONFIGURATION ==>
const clientUrl = process.env.CLIENT_URL ?? "";

// <== ALLOWED ORIGINS FOR CORS ==>
const allowedOrigins = clientUrl
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

// <== EXPORTING ALLOWED ORIGINS ==>
export default allowedOrigins;
