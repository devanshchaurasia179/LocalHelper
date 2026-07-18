import { Router } from "express";
import {
  getPendingVerifications,
  getPartnerVerificationDetail,
  approveDocument,
  rejectDocument,
  forceApproveVerification,
  forceRejectVerification,
} from "../../controllers/admin/admin.verification.controller.js";
import { protectAdmin, authorizeRoles } from "../../middleware/admin.auth.middleware.js";

const router = Router();

// All routes require a valid admin session
router.use(protectAdmin);

// SUPPORT role is read-only — they can view but not act
// ADMIN and SUPER_ADMIN can perform all actions

// ─── Read routes — all roles ──────────────────────────────────────────────────

/**
 * GET /api/admin/verification/pending
 * Returns partners whose session is "Under Review", sorted by submission time.
 * This is the admin's work queue — oldest submissions reviewed first.
 */
router.get("/pending", getPendingVerifications);

/**
 * GET /api/admin/verification/:partnerId
 * Full verification detail for one partner:
 *   partner profile + active session + all documents with admin-level metadata.
 */
router.get("/:partnerId", getPartnerVerificationDetail);

// ─── Document-level actions — ADMIN and SUPER_ADMIN only ─────────────────────

/**
 * PATCH /api/admin/verification/:partnerId/documents/:documentId/approve
 * Approves a single document.
 * Auto-promotes overall verification to Approved if all required docs are done.
 * Body: { note? }
 */
router.patch(
  "/:partnerId/documents/:documentId/approve",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  approveDocument
);

/**
 * PATCH /api/admin/verification/:partnerId/documents/:documentId/reject
 * Rejects a single document with a mandatory reason.
 * Sets overall verification to Rejected.
 * Body: { reason }  — required, min 10 chars
 */
router.patch(
  "/:partnerId/documents/:documentId/reject",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  rejectDocument
);

// ─── Overall verification override — ADMIN and SUPER_ADMIN only ──────────────

/**
 * PATCH /api/admin/verification/:partnerId/approve
 * Force-approves the entire verification regardless of individual doc states.
 * Used when admin is satisfied and wants to skip the auto-promotion check.
 * Body: { note? }
 */
router.patch(
  "/:partnerId/approve",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  forceApproveVerification
);

/**
 * PATCH /api/admin/verification/:partnerId/reject
 * Force-rejects the entire verification with a mandatory reason.
 * Used for policy violations or fraud — overrides individual document states.
 * Body: { reason }  — required, min 10 chars
 */
router.patch(
  "/:partnerId/reject",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  forceRejectVerification
);

export default router;
