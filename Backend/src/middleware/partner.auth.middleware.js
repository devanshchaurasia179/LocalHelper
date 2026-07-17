import jwt from "jsonwebtoken";
import Partner from "../models/partner/Partner.js";

/**
 * Protects partner routes.
 * Reads JWT from the partner_token cookie and attaches partnerId to req.
 * Also checks accountStatus and isDeleted so blocked/suspended/deleted
 * partners cannot access the app even with a valid token.
 */
const protectPartner = async (req, res, next) => {
  const token = req.cookies?.partner_token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch minimal partner fields needed for the auth check
    const partner = await Partner.findById(decoded.id).select(
      "accountStatus isDeleted"
    );

    if (!partner) {
      return res.status(401).json({ message: "Account not found." });
    }

    if (partner.isDeleted) {
      return res.status(403).json({ message: "This account has been deleted." });
    }

    if (partner.accountStatus === "Blocked") {
      return res.status(403).json({
        message: "Your account has been blocked. Contact support.",
      });
    }

    if (partner.accountStatus === "Suspended") {
      return res.status(403).json({
        message: "Your account is under review. Contact support.",
      });
    }

    req.partnerId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

export default protectPartner;
