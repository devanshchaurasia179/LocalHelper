import express from "express";
import {
  sendOtp,
  verifyOtp,
  completeProfile,
  logout,
  getMe,
} from "../controllers/partner.auth.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/logout", logout); // No auth check — just clears the cookie

// Protected routes (requires valid partner_token cookie)
router.get("/me", protectPartner, getMe);
router.put("/complete-profile", protectPartner, completeProfile);

export default router;
