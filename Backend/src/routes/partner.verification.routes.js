import { Router } from "express";
import multer from "multer";
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
router.post(
  "/documents",
  // Run multer as a local middleware so we can catch its errors here
  // and return JSON instead of Express's default HTML error page.
  (req, res, next) => {
    multerUploadDocument.single("file")(req, res, (err) => {
      if (!err) return next();

      // Multer rejects unsupported MIME types with a plain Error.
      // MulterError is a class with a .code property for size/field errors.
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "File too large. Maximum upload size is 50 MB.",
          });
        }
        return res.status(400).json({ message: err.message });
      }

      // Our custom fileFilter error — unsupported MIME type
      return res.status(400).json({
        message: err.message ?? "Unsupported file type.",
      });
    });
  },
  uploadDocument
);

export default router;
