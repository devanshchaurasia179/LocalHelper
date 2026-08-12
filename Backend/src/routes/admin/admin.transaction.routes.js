import express from "express";
import {
  adminGetPartnerTransactions,
  adminProcessPayout,
  adminAdjustBalance,
} from "../../controllers/partner.transaction.controller.js";
import { protectAdmin } from "../../middleware/admin.auth.middleware.js";

const router = express.Router();

// All routes require a valid admin session
router.use(protectAdmin);

// GET  /api/admin/transactions/:id/process  — view payout queue (reuses partner filter)
router.get( "/partners/:partnerId/transactions",         adminGetPartnerTransactions); // GET  /api/admin/partners/:partnerId/transactions
router.patch("/transactions/:id/process",                adminProcessPayout);          // PATCH /api/admin/transactions/:id/process
router.post( "/partners/:partnerId/transactions/adjust", adminAdjustBalance);          // POST /api/admin/partners/:partnerId/transactions/adjust

export default router;
