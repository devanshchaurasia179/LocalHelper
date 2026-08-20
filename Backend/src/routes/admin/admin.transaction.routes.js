import express from "express";
import {
  adminGetPayoutQueue,
  adminGetPartnerTransactions,
  adminProcessPayout,
  adminAdjustBalance,
} from "../../controllers/partner.transaction.controller.js";
import {
  adminGetCustomerTransactions,
  adminAdjustBalance as adminAdjustCustomerBalance,
} from "../../controllers/customer.wallet.controller.js";
import { protectAdmin } from "../../middleware/admin.auth.middleware.js";

const router = express.Router();

// All routes require a valid admin session
router.use(protectAdmin);

// ── Partner transaction routes ────────────────────────────────────────────────
router.get( "/transactions/payout-queue",                adminGetPayoutQueue);         // GET  /api/admin/transactions/payout-queue
router.get( "/partners/:partnerId/transactions",         adminGetPartnerTransactions); // GET  /api/admin/partners/:partnerId/transactions
router.patch("/transactions/:id/process",                adminProcessPayout);          // PATCH /api/admin/transactions/:id/process
router.post( "/partners/:partnerId/transactions/adjust", adminAdjustBalance);          // POST /api/admin/partners/:partnerId/transactions/adjust

// ── Customer transaction routes ───────────────────────────────────────────────
router.get( "/customers/:customerId/transactions",         adminGetCustomerTransactions);  // GET  /api/admin/customers/:customerId/transactions
router.post("/customers/:customerId/transactions/adjust",  adminAdjustCustomerBalance);    // POST /api/admin/customers/:customerId/transactions/adjust

export default router;
