import { Router } from "express";
import { getCallRecording } from "../../controllers/admin/admin.callRecording.controller.js";
import { protectAdmin } from "../../middleware/admin.auth.middleware.js";

const router = Router();

// All routes require admin authentication
router.use(protectAdmin);

// GET /api/admin/calls/:callId/recording
router.get("/:callId/recording", getCallRecording);

export default router;
