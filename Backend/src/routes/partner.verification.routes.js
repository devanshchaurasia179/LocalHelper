import { Router } from "express";
import {
  getVerificationStatus,
  uploadDocument,
} from "../controllers/partner.verification.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";
import { uploadDocument as multerUploadDocument } from "../middleware/upload.middleware.js";

const router = Router();

// All routes require a valid partner session
router.use(protectPartner);

/**
 * GET /api/partner/verification
 *
 * Returns the complete verification state for the logged-in partner.
 * Response includes:
 *   - verificationStatus  — overall status (Pending | Under Review | Approved | Rejected)
 *   - sessionStatus       — granular session status (In Progress | Under Review | etc.)
 *   - summary             — counts: total, uploaded, approved, rejected, missing
 *   - documents[]         — merged config + upload state for every relevant document type
 *
 * The frontend renders this directly. No business logic required client-side.
 */
router.get("/", getVerificationStatus);

/**
 * POST /api/partner/documents
 *
 * Upload a document. Works for ANY document type — no hardcoding.
 * Content-Type: multipart/form-data
 *
 * Fields:
 *   file            (binary)  — the image/PDF file, field name must be "file"
 *   documentTypeId  (string)  — ObjectId of the DocumentType to upload for
 *   side            (string)  — "single" | "front" | "back"
 *   numberValue     (string)  — only required when DocumentType.hasNumberField = true
 *
 * One file per request. For multi-page documents (e.g., Aadhaar), call twice:
 *   POST with side=front → uploads front
 *   POST with side=back  → uploads back
 */
router.post("/documents", multerUploadDocument.single("file"), uploadDocument);

export default router;
