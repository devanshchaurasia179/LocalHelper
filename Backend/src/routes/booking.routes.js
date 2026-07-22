import express from "express";
import jwt from "jsonwebtoken";
import {
  createBooking,
  acceptBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  reviewBooking,
  getPartnerBookings,
  getCustomerBookings,
  getBookingById,
  getPartnerReviews,
} from "../controllers/booking.controller.js";
import protectPartner  from "../middleware/partner.auth.middleware.js";
import protectCustomer from "../middleware/customer.auth.middleware.js";

const router = express.Router();

// ─── Dual-auth middleware ─────────────────────────────────────────────────────
// Accepts either partner_token or customer_token (or both).
// Attaches req.partnerId AND/OR req.customerId — controller decides which applies.
const protectEither = (req, res, next) => {
  const partnerToken  = req.cookies?.partner_token;
  const customerToken = req.cookies?.customer_token;

  if (!partnerToken && !customerToken) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  // Try partner token
  if (partnerToken) {
    try {
      const decoded = jwt.verify(partnerToken, process.env.JWT_SECRET);
      req.partnerId = decoded.id;
    } catch {
      // invalid/expired — ignore
    }
  }

  // Try customer token
  if (customerToken) {
    try {
      const decoded = jwt.verify(customerToken, process.env.JWT_SECRET);
      req.customerId = decoded.id;
    } catch {
      // invalid/expired — ignore
    }
  }

  // At least one must have resolved
  if (!req.partnerId && !req.customerId) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  return next();
};

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/partners/:partnerId/reviews", getPartnerReviews); // Partner's reviews

// ─── Customer-only ────────────────────────────────────────────────────────────
router.post("/",           protectCustomer, createBooking);      // Create booking
router.get("/customer",    protectCustomer, getCustomerBookings); // Customer's booking list
router.post("/:id/review", protectCustomer, reviewBooking);       // Leave review

// ─── Partner-only ─────────────────────────────────────────────────────────────
router.get("/partner",        protectPartner, getPartnerBookings); // Partner's booking list
router.patch("/:id/accept",   protectPartner, acceptBooking);      // Accept
router.patch("/:id/start",    protectPartner, startBooking);       // Start work
router.patch("/:id/complete", protectPartner, completeBooking);    // Complete

// ─── Shared (partner OR customer) ────────────────────────────────────────────
// These must come AFTER named segment routes (/partner, /customer)
// so Express doesn't swallow them as :id params.
router.patch("/:id/cancel", protectEither, cancelBooking);  // Either party cancels
router.get("/:id",          protectEither, getBookingById); // View single booking

export default router;
