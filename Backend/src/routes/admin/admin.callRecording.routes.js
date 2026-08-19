import { Router } from "express";
import { getCallRecording } from "../../controllers/admin/admin.callRecording.controller.js";
import { getAllCalls } from "../../controllers/admin/admin.calls.controller.js";
import { protectAdmin } from "../../middleware/admin.auth.middleware.js";

const router = Router();

// All routes require admin authentication
router.use(protectAdmin);

// GET /api/admin/calls — list all calls with pagination, search, filters
router.get("/", getAllCalls);

// GET /api/admin/calls/:callId/recording — get signed URL for recording playback
router.get("/:callId/recording", getCallRecording);

export default router;
