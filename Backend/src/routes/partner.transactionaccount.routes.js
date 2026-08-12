import express from "express";
import {
  getTransactionAccount,
  saveBankAccount,
  saveUpiId,
  setPreferredMethod,
  deleteBankAccount,
  deleteUpiId,
} from "../controllers/partner.transactionaccount.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";

const router = express.Router();

// All routes require a valid partner session
router.use(protectPartner);

router.get("/",                   getTransactionAccount);  // GET    /api/partner/transaction-account
router.put("/bank",               saveBankAccount);        // PUT    /api/partner/transaction-account/bank
router.put("/upi",                saveUpiId);              // PUT    /api/partner/transaction-account/upi
router.patch("/preferred-method", setPreferredMethod);     // PATCH  /api/partner/transaction-account/preferred-method
router.delete("/bank",            deleteBankAccount);      // DELETE /api/partner/transaction-account/bank
router.delete("/upi",             deleteUpiId);            // DELETE /api/partner/transaction-account/upi

export default router;
