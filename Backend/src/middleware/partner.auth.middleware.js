import jwt from "jsonwebtoken";

/**
 * Protects partner routes.
 * Reads JWT from the partner_token cookie and attaches partnerId to req.
 */
const protectPartner = (req, res, next) => {
  const token = req.cookies?.partner_token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.partnerId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

export default protectPartner;
