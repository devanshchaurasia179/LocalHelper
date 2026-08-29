import express from "express";
import {
  registerFcmToken,
  unregisterFcmToken,
} from "../controllers/customer.notification.controller.js";
import protectCustomer from "../middleware/customer.auth.middleware.js";

const router = express.Router();

// Protected routes (requires valid customer_token cookie)
router.post("/fcm-token", protectCustomer, registerFcmToken);
router.delete("/fcm-token", protectCustomer, unregisterFcmToken);

export default router;
