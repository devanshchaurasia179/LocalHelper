import jwt from "jsonwebtoken";

/**
 * Protects customer routes.
 * Reads JWT from the customer_token cookie and attaches customerId to req.
 */
const protectCustomer = (req, res, next) => {
  const token = req.cookies?.customer_token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.customerId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

export default protectCustomer;
