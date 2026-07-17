import { Router } from "express";
import {
  getAllPartners,
  getPendingPartners,
  getPartnerById,
  approvePartner,
  rejectPartner,
  blockPartner,
  unblockPartner,
  suspendPartner,
  reactivatePartner,
  softDeletePartner,
} from "../../controllers/admin/admin.partner.controller.js";
import { protectAdmin, authorizeRoles } from "../../middleware/admin.auth.middleware.js";

const router = Router();

// All routes below require a valid admin session
router.use(protectAdmin);

// ── Read routes — all roles can view ─────────────────────────────────────────
router.get("/",        getAllPartners);
router.get("/pending", getPendingPartners);
router.get("/:id",     getPartnerById);

// ── Verification routes — ADMIN and SUPER_ADMIN only ─────────────────────────
router.patch("/:id/approve", authorizeRoles("SUPER_ADMIN", "ADMIN"), approvePartner);
router.patch("/:id/reject",  authorizeRoles("SUPER_ADMIN", "ADMIN"), rejectPartner);

// ── Management routes — ADMIN and SUPER_ADMIN only ───────────────────────────
router.patch("/:id/block",      authorizeRoles("SUPER_ADMIN", "ADMIN"), blockPartner);
router.patch("/:id/unblock",    authorizeRoles("SUPER_ADMIN", "ADMIN"), unblockPartner);
router.patch("/:id/suspend",    authorizeRoles("SUPER_ADMIN", "ADMIN"), suspendPartner);
router.patch("/:id/reactivate", authorizeRoles("SUPER_ADMIN", "ADMIN"), reactivatePartner);

// ── Destructive routes — SUPER_ADMIN only ────────────────────────────────────
router.delete("/:id", authorizeRoles("SUPER_ADMIN"), softDeletePartner);

export default router;
