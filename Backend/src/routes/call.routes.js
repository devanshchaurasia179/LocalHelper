import express from "express";
import {
  createCall,
  createCallAsPartner,
  blockPartner,
  unblockPartner,
  blockCustomer,
  unblockCustomer,
  acceptCall,
  rejectCall,
  endCall,
} from "../controllers/call.controller.js";
import protectCustomer from "../middleware/customer.auth.middleware.js";
import protectPartner from "../middleware/partner.auth.middleware.js";

const router = express.Router();

// ── Customer initiates a call to a partner ────────────────────────────────────
router.post("/", protectCustomer, createCall);

// ── Partner initiates a call to a customer ────────────────────────────────────
router.post("/partner", protectPartner, createCallAsPartner);

// ── Block / Unblock (customer side) ──────────────────────────────────────────
router.post("/block/partner/:partnerId", protectCustomer, blockPartner);
router.delete("/block/partner/:partnerId", protectCustomer, unblockPartner);

// ── Block / Unblock (partner side) ───────────────────────────────────────────
router.post("/block/customer/:customerId", protectPartner, blockCustomer);
router.delete("/block/customer/:customerId", protectPartner, unblockCustomer);

// ── Accept / Reject / End Call ───────────────────────────────────────────────
router.post("/:callId/accept", protectPartner, acceptCall);
router.post("/:callId/reject", protectPartner, rejectCall);

// Allow both customer and partner to end a call
const protectEither = (req, res, next) => {
  // Try customer auth first
  protectCustomer(req, res, (err) => {
    if (!err) return next();
    // Try partner auth if customer auth failed
    protectPartner(req, res, next);
  });
};
router.post("/:callId/end", protectEither, endCall);

export default router;
