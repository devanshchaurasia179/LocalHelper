import express from "express";
import {
  submitKyc,
  getDocuments,
  replaceKycImage,
} from "../controllers/partner.documents.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

// All document routes require a valid partner session
router.use(protectPartner);

// Accept up to 4 image fields: aadhaarFront, aadhaarBack, panImage, selfie
const kycUpload = upload.fields([
  { name: "aadhaarFront", maxCount: 1 },
  { name: "aadhaarBack",  maxCount: 1 },
  { name: "panImage",     maxCount: 1 },
  { name: "selfie",       maxCount: 1 },
]);

router.put("/kyc",          kycUpload,               submitKyc);       // Initial KYC submission
router.patch("/kyc/:field", upload.single("image"),  replaceKycImage); // Replace a single image
router.get("/",                                       getDocuments);    // Get all documents

export default router;
