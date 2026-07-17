import { Router } from "express";
import {
  getAllPartners,
  getPendingPartners,
  getPartnerById,
  approvePartner,
  rejectPartner,
} from "../../controllers/admin/admin.partner.controller.js";
import { protectAdmin, authorizeRoles } from "../../middleware/admin.auth.middleware.js";

const router = Router();

// All routes below require a valid admin session
router.use(protectAdmin);

// ── Read routes — all roles can view ─────────────────────────────────────────
router.get("/",        getAllPartners);
router.get("/pending", getPendingPartners);
router.get("/:id",     getPartnerById);

// ── Write routes — ADMIN and SUPER_ADMIN only (not SUPPORT) ──────────────────
router.patch("/:id/approve", authorizeRoles("SUPER_ADMIN", "ADMIN"), approvePartner);
router.patch("/:id/reject",  authorizeRoles("SUPER_ADMIN", "ADMIN"), rejectPartner);

export default router;
