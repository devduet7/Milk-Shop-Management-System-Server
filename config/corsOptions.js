// <== IMPORTS ==>
import allowedOrigins from "./allowedOrigins.js";

// <== CORS OPTIONS ==>
const corsOptions = {
  // ALLOWED ORIGINS
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
  // ALLOWING CREDENTIALS
  credentials: true,
  // ALLOWING OPTIONS
  optionsSuccessStatus: 200,
};

// <== EXPORTING CORS OPTIONS ==>
export default corsOptions;
