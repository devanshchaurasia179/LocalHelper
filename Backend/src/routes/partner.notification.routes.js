import express from "express";
import {
  registerFcmToken,
  unregisterFcmToken,
} from "../controllers/partner.notification.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";

const router = express.Router();

// Protected routes (requires valid partner_token cookie)
router.post("/fcm-token", protectPartner, registerFcmToken);
router.delete("/fcm-token", protectPartner, unregisterFcmToken);

export default router;
