import { Router } from "express";
import multer from "multer";
import {
  getVerificationStatus,
  uploadDocument,
  submitVerification,
  deleteDocumentPhoto,
} from "../controllers/partner.verification.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";
import { uploadDocument as multerUploadDocument } from "../middleware/upload.middleware.js";

const router = Router();

// All routes require a valid partner session
router.use(protectPartner);

/**
 * GET /api/partner/verification
 */
router.get("/", getVerificationStatus);

/**
 * POST /api/partner/verification/submit
 * Transitions all Pending documents → Under Review and locks the session.
 */
router.post("/submit", submitVerification);

/**
 * POST /api/partner/verification/documents
 * Upload one file for any document type. Saves as "Pending" until submit.
 */
router.post(
  "/documents",
  (req, res, next) => {
    multerUploadDocument.single("file")(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "File too large. Maximum upload size is 50 MB." });
        }
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message ?? "Unsupported file type." });
    });
  },
  uploadDocument
);

/**
 * DELETE /api/partner/verification/documents/:documentTypeId/:side/photos/:photoIndex
 *
 * Removes one photo (0-based index) from a "Pending" document slot.
 * If it was the last photo, the entire slot record is deleted (→ "missing").
 * Locked "Under Review" / "Approved" slots return 404 — they cannot be edited.
 */
router.delete(
  "/documents/:documentTypeId/:side/photos/:photoIndex",
  deleteDocumentPhoto
);

export default router;
