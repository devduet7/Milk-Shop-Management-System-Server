// <== IMPORTS ==>
import { USER_ROLES, PERMISSION_LEVELS } from "../models/user.model.js";

// <== PERMISSION LEVEL WEIGHTS — USED FOR ORDINAL COMPARISON ==>
const LEVEL_WEIGHT = {
  [PERMISSION_LEVELS.NONE]: 0,
  [PERMISSION_LEVELS.READ]: 1,
  [PERMISSION_LEVELS.WRITE]: 2,
  [PERMISSION_LEVELS.UPDATE]: 3,
};

/**
 * REQUIRE ROLE MIDDLEWARE FACTORY
 * RESTRICTS A ROUTE TO SPECIFIC ROLES — USE FOR MODULES WITH NO PER-USER DELEGATION
 * @param {...string} allowedRoles - ROLES PERMITTED TO ACCESS THIS ROUTE
 * @returns {import("express").RequestHandler}
 */
// <== REQUIRE ROLE ==>
export const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    // CHECKING IF THE AUTHENTICATED USER'S ROLE IS IN THE ALLOWED LIST
    if (!allowedRoles.includes(req.role)) {
      // RETURNING FORBIDDEN RESPONSE
      res.status(403).json({
        message: "You do not have Permission to Perform this Action!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // CALLING NEXT MIDDLEWARE
    next();
  };

/**
 * REQUIRE PERMISSION MIDDLEWARE FACTORY
 * GATES A ROUTE BEHIND A MINIMUM ORDINAL PERMISSION LEVEL FOR A GIVEN MODULE
 * SUPERADMIN AND ADMIN ALWAYS BYPASS THIS CHECK — THEY ARE UNRESTRICTED ON EVERY DELEGABLE MODULE
 * @param {string} moduleKey - MODULE KEY (MUST MATCH FIELD NAME ON THE USER PERMISSIONS SUBSCHEMA)
 * @param {string} minLevel - MINIMUM REQUIRED PERMISSION LEVEL
 * @returns {import("express").RequestHandler}
 */
// <== REQUIRE PERMISSION ==>
export const requirePermission = (moduleKey, minLevel) => (req, res, next) => {
  // SUPERADMIN AND ADMIN BYPASS THE PERMISSION MATRIX ENTIRELY
  if (req.role === USER_ROLES.SUPERADMIN || req.role === USER_ROLES.ADMIN) {
    // CALLING NEXT MIDDLEWARE
    next();
    // RETURNING FROM FUNCTION
    return;
  }
  // RESOLVING THE USER'S CURRENT LEVEL FOR THIS MODULE (DEFAULTS TO NONE IF UNSET)
  const userLevel = req.permissions?.[moduleKey] || PERMISSION_LEVELS.NONE;
  // COMPARING ORDINAL WEIGHTS — REJECTING IF THE USER'S LEVEL IS BELOW THE REQUIRED MINIMUM
  if (LEVEL_WEIGHT[userLevel] < LEVEL_WEIGHT[minLevel]) {
    // RETURNING FORBIDDEN RESPONSE
    res.status(403).json({
      message: "You do not have Permission to Perform this Action!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CALLING NEXT MIDDLEWARE
  next();
};
