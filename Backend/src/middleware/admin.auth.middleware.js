import jwt from "jsonwebtoken";
import Admin from "../models/admin/Admin.js";

/**
 * protectAdmin
 *
 * Middleware that guards every admin route.
 * Execution order:
 *   1. Read admin_token from cookie
 *   2. Verify JWT signature and expiry
 *   3. Pull admin from DB (ensures account still exists and isActive)
 *   4. Attach full admin object to req.admin
 *   5. Call next() to reach the controller
 *
 * Why do we hit the DB here instead of trusting the JWT alone?
 *   JWTs are stateless — if we disable an admin (isActive = false),
 *   their existing token would still pass JWT verification.
 *   Checking the DB ensures the account state is always current.
 */
export const protectAdmin = async (req, res, next) => {
  try {
    const token = req.cookies?.admin_token;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    // jwt.verify throws if the token is tampered with or expired.
    // We embedded { id, role } in the payload at sign time.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch admin from DB — select: false on password means it won't be included
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(401).json({ message: "Admin account not found." });
    }

    if (!admin.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated." });
    }

    // Attach to request — controllers can read req.admin.role, req.admin._id, etc.
    req.admin = admin;
    next();
  } catch (error) {
    // jwt.verify throws JsonWebTokenError or TokenExpiredError
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

/**
 * authorizeRoles(...roles)
 *
 * Factory function — returns a middleware that checks if req.admin.role
 * is in the allowed roles list.
 *
 * Usage:
 *   router.delete("/partners/:id", protectAdmin, authorizeRoles("SUPER_ADMIN"), deletePartner)
 *
 * Always place AFTER protectAdmin since we read req.admin here.
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(" or ")}.`,
      });
    }
    next();
  };
};
