import express from "express";
import {
  getTransactionHistory,
  getWalletSummary,
  getTransactionById,
  requestPayout,
} from "../controllers/partner.transaction.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";

const router = express.Router();

// All routes require a valid partner session
router.use(protectPartner);

router.get("/",                  getTransactionHistory); // GET   /api/partner/transactions
router.get("/summary",           getWalletSummary);      // GET   /api/partner/transactions/summary
router.get("/:id",               getTransactionById);    // GET   /api/partner/transactions/:id
router.post("/payout-request",   requestPayout);         // POST  /api/partner/transactions/payout-request

export default router;
