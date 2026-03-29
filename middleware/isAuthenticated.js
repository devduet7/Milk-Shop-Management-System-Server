// <== IMPORTS ==>
import jwt from "jsonwebtoken";

/**
 * AUTHENTICATION MIDDLEWARE
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
    decodedToken = jwt.verify(accessToken, process.env.AT_SECRET);
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
  if (!decodedToken || !decodedToken.userId) {
    // RETURNING UNAUTHORIZED RESPONSE
    res.status(401).json({
      message: "Unauthorized to Perform Action!",
      success: false,
      code: "INVALID_TOKEN_PAYLOAD",
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // ATTACHING USER ID TO REQUEST OBJECT FOR USE IN DOWNSTREAM CONTROLLERS
  req.id = decodedToken.userId;
  // CALLING NEXT MIDDLEWARE
  next();
};

// <== EXPORTING AUTHENTICATION MIDDLEWARE ==>
export default isAuthenticated;
