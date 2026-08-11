// <== IMPORTS ==>
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * AUTHENTICATION MIDDLEWARE
 * VERIFIES THE ACCESS TOKEN AND ATTACHES THE EMBEDDED IDENTITY/ROLE/PERMISSION CLAIMS TO THE REQUEST
 * DOES NOT HIT THE DATABASE — ROLE AND PERMISSION CHANGES TAKE EFFECT ON THE NEXT TOKEN REFRESH
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @param {import("express").NextFunction} next - Next Function
 * @returns {void}
 */
// <== IS AUTHENTICATED ==>
const isAuthenticated = (req, res, next) => {
  // CHECKING FOR ACCESS TOKEN IN REQUEST COOKIES
  const accessToken = req.cookies.accessToken;
  // IF NO ACCESS TOKEN FOUND IN COOKIES
  if (!accessToken) {
    // RETURNING UNAUTHORIZED RESPONSE (CLIENT SHOULD TRY REFRESH TOKEN)
    res.status(401).json({
      message: "Unauthorized to Perform Action!",
      success: false,
      code: "NO_ACCESS_TOKEN",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // INITIATING DECODED TOKEN
  let decodedToken;
  try {
    // VERIFYING AND DECODING THE ACCESS TOKEN
    decodedToken = jwt.verify(accessToken, env.AT_SECRET);
  } catch (error) {
    // IF TOKEN IS EXPIRED, CLIENT SHOULD CALL REFRESH TOKEN ENDPOINT
    if (error.name === "TokenExpiredError") {
      // RETURNING UNAUTHORIZED RESPONSE WITH EXPIRED TOKEN CODE
      res.status(401).json({
        message: "Access Token Expired!",
        success: false,
        code: "ACCESS_TOKEN_EXPIRED",
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // IF TOKEN IS INVALID OR ANY OTHER ERROR OCCURS
    res.status(401).json({
      message: "Invalid Access Token!",
      success: false,
      code: "INVALID_ACCESS_TOKEN",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // VALIDATING DECODED TOKEN PAYLOAD
  if (
    !decodedToken ||
    !decodedToken.userId ||
    !decodedToken.accountId ||
    !decodedToken.role
  ) {
    // RETURNING UNAUTHORIZED RESPONSE
    res.status(401).json({
      message: "Unauthorized to Perform Action!",
      success: false,
      code: "INVALID_TOKEN_PAYLOAD",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // ATTACHING USER ID TO REQUEST OBJECT — UNCHANGED FOR BACKWARD COMPATIBILITY WITH EXISTING CONTROLLERS
  req.id = decodedToken.userId;
  // ATTACHING ACCOUNT ID TO REQUEST OBJECT — THE TENANT THIS REQUEST IS SCOPED TO
  req.accountId = decodedToken.accountId;
  // ATTACHING ROLE TO REQUEST OBJECT
  req.role = decodedToken.role;
  // ATTACHING PERMISSIONS MATRIX TO REQUEST OBJECT (NULL FOR SUPERADMIN/ADMIN — THEY ARE UNRESTRICTED)
  req.permissions = decodedToken.permissions || null;
  // CALLING NEXT MIDDLEWARE
  next();
};

// <== EXPORTING AUTHENTICATION MIDDLEWARE ==>
export default isAuthenticated;
