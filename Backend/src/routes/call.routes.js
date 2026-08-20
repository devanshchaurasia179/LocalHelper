import express from "express";
import {
  createCall,
  createCallAsPartner,
  blockPartner,
  unblockPartner,
  getBlockedPartners,
  blockCustomer,
  unblockCustomer,
  acceptCall,
  acceptCallAsCustomer,
  rejectCall,
  rejectCallAsCustomer,
  endCall,
  getCallHistory,
  getPartnerCallHistory,
  rechargeCallBalance,
  getCallBalance,
  rechargeDuringCall,
} from "../controllers/call.controller.js";
import protectCustomer from "../middleware/customer.auth.middleware.js";
import protectPartner from "../middleware/partner.auth.middleware.js";

const router = express.Router();

// ── Customer initiates a call to a partner ────────────────────────────────────
router.post("/", protectCustomer, createCall);

// ── Partner initiates a call to a customer ────────────────────────────────────
router.post("/partner", protectPartner, createCallAsPartner);

// ── Call balance (customer) ──────────────────────────────────────────────────
router.get("/balance", protectCustomer, getCallBalance);
router.post("/recharge", protectCustomer, rechargeCallBalance);
router.post("/recharge-during-call", protectCustomer, rechargeDuringCall);

// ── Call history ─────────────────────────────────────────────────────────────
router.get("/history/customer", protectCustomer, getCallHistory);
router.get("/history/partner", protectPartner, getPartnerCallHistory);

// ── Block / Unblock (customer side) ──────────────────────────────────────────
router.get("/blocked-partners", protectCustomer, getBlockedPartners);
router.post("/block/partner/:partnerId", protectCustomer, blockPartner);
router.delete("/block/partner/:partnerId", protectCustomer, unblockPartner);

// ── Block / Unblock (partner side) ───────────────────────────────────────────
router.post("/block/customer/:customerId", protectPartner, blockCustomer);
router.delete("/block/customer/:customerId", protectPartner, unblockCustomer);

// ── Accept / Reject / End Call ───────────────────────────────────────────────
router.post("/:callId/accept", protectPartner, acceptCall);
router.post("/:callId/reject", protectPartner, rejectCall);

// ── Customer accepts/rejects incoming call (from partner) ───────────────────
router.post("/:callId/accept-customer", protectCustomer, acceptCallAsCustomer);
router.post("/:callId/reject-customer", protectCustomer, rejectCallAsCustomer);

// Allow both customer and partner to end a call
const protectEither = (req, res, next) => {
  const customerToken = req.cookies?.customer_token;
  const partnerToken = req.cookies?.partner_token;

  if (customerToken) {
    return protectCustomer(req, res, next);
  }

  if (partnerToken) {
    return protectPartner(req, res, next);
  }

  return res.status(401).json({ message: "Unauthorized. Please log in." });
};
router.post("/:callId/end", protectEither, endCall);

export default router;
