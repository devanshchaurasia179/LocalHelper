import { Router } from "express";
import {
  createDocumentType,
  listDocumentTypes,
  getDocumentTypeById,
  updateDocumentType,
  toggleDocumentType,
  updateDisplayOrder,
  uploadSampleImage,
  deleteSampleImage,
  deleteDocumentType,
} from "../../controllers/admin/admin.documentType.controller.js";
import { protectAdmin, authorizeRoles } from "../../middleware/admin.auth.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";

const router = Router();

// All routes in this file require a valid admin session
router.use(protectAdmin);

// ─── Document Type CRUD ────────────────────────────────────────────────────────

// List all document types (active + inactive) — admin panel needs both
router.get("/", listDocumentTypes);

// Get single document type with stats
router.get("/:id", getDocumentTypeById);

// Create a new document type
router.post("/", createDocumentType);

// Partial update (any field except key)
router.patch("/:id", updateDocumentType);

// Toggle isActive on/off — dedicated endpoint for explicit intent
router.patch("/:id/toggle", toggleDocumentType);

// Change display order only — called by drag-and-drop reorder UI
router.patch("/:id/order", updateDisplayOrder);

// ─── Sample image ──────────────────────────────────────────────────────────────

// Upload a sample image — multer handles the binary, then we upload to Cloudinary
router.post(
  "/:id/sample-image",
  upload.single("sampleImage"),
  uploadSampleImage
);

// Remove the sample image
router.delete("/:id/sample-image", deleteSampleImage);

// ─── Hard delete — SUPER_ADMIN only ───────────────────────────────────────────
// Regular admins should use toggle to disable, not delete.
// Hard delete is restricted to SUPER_ADMIN and blocked if any uploads exist.
router.delete(
  "/:id",
  authorizeRoles("SUPER_ADMIN"),
  deleteDocumentType
);

export default router;
