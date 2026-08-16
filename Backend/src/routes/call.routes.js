import express from "express";
import {
  createCall,
  createCallAsPartner,
  blockPartner,
  unblockPartner,
  blockCustomer,
  unblockCustomer,
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

export default router;
