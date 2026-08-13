import express from "express";
import {
  getTransactionHistory,
  getWalletSummary,
  getTransactionById,
  initiateTopup,
} from "../controllers/customer.wallet.controller.js";
import protectCustomer from "../middleware/customer.auth.middleware.js";

const router = express.Router();

// All routes require a valid customer session
router.use(protectCustomer);

// GET  /api/customer/transactions/summary  — wallet balance + lifetime totals
// NOTE: must be registered BEFORE /:id so "summary" isn't treated as an ObjectId
router.get("/summary", getWalletSummary);

// GET  /api/customer/transactions          — paginated history (type, status, date filters)
router.get("/", getTransactionHistory);

// GET  /api/customer/transactions/:id      — single transaction detail
router.get("/:id", getTransactionById);

// POST /api/customer/transactions/topup    — add funds directly to wallet (gateway to be added later)
router.post("/topup", initiateTopup);

export default router;
