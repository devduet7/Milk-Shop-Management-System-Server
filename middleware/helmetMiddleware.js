// <== IMPORTS ==>
import helmet from "helmet";

// <== HELMET MIDDLEWARE CONFIGURATION ==>
const helmetMiddleware = () => {
  // CONFIGURING HELMET
  return helmet({
    contentSecurityPolicy: false,
  });
};

// <== EXPORTING HELMET MIDDLEWARE ==>
export default helmetMiddleware;
