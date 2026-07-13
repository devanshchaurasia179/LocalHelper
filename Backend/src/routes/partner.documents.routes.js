import express from "express";
import {
  submitKyc,
  getDocuments,
} from "../controllers/partner.documents.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";

const router = express.Router();

// All document routes require a valid partner session
router.use(protectPartner);

router.put("/kyc", submitKyc); // Submit Aadhaar + PAN
router.get("/", getDocuments); // Get all documents

export default router;
