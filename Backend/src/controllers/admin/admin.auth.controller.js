import jwt from "jsonwebtoken";
import Admin from "../../models/admin/Admin.js";

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Signs a JWT containing the admin's id and role.
 * We include role in the token so authorizeRoles middleware could
 * theoretically skip the DB call — but we still check DB in protectAdmin
 * to catch deactivated accounts.
 */
const signToken = (adminId, role) =>
  jwt.sign({ id: adminId, role }, process.env.JWT_SECRET, { expiresIn: "1d" });

/**
 * Sets the JWT as an httpOnly cookie.
 *
 * httpOnly  → JS running in the browser (XSS payload) cannot read this cookie
 * secure    → only sent over HTTPS in production
 * sameSite  → strict prevents CSRF (the cookie won't be sent on cross-site requests)
 * maxAge    → 1 day in milliseconds
 */
const sendTokenCookie = (res, token) => {
  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/login
 * Body: { email, password }
 *
 * Flow:
 *   1. Validate input
 *   2. Find admin by email (explicitly select password — it has select:false)
 *   3. Compare password with bcrypt
 *   4. Check isActive
 *   5. Update lastLogin timestamp
 *   6. Sign JWT → set cookie
 *   7. Return admin info (no password)
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic input validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // .select("+password") overrides the select:false on the password field.
    // We MUST do this here — otherwise comparePassword would compare against undefined.
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select("+password");

    if (!admin) {
      // Generic message — don't reveal whether email exists or not
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // comparePassword is the instance method we defined on the model
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!admin.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated. Contact support." });
    }

    // Record login time — useful for security audits
    admin.lastLogin = new Date();
    await admin.save();

    const token = signToken(admin._id, admin.role);
    sendTokenCookie(res, token);

    return res.status(200).json({
      message: "Login successful.",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/logout
 *
 * Clears the admin_token cookie.
 * On the client side, the admin is now unauthenticated.
 *
 * Note: the JWT itself is still technically valid until it expires (1 day).
 * For true token invalidation you'd need a token blocklist in Redis.
 * For this stage, clearing the cookie is sufficient.
 */
export const logout = (req, res) => {
  res.clearCookie("admin_token", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return res.status(200).json({ message: "Logged out successfully." });
};

// ─── GET ME ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/me
 * Protected by protectAdmin middleware
 *
 * Returns the currently authenticated admin's profile.
 * req.admin is populated by the protectAdmin middleware.
 * We never return the password — it has select:false and we don't override it here.
 */
export const getMe = async (req, res) => {
  try {
    // req.admin was attached by protectAdmin — no DB call needed
    const admin = req.admin;

    return res.status(200).json({
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
