import express from "express";
import {
  sendOtp,
  verifyOtp,
  completeProfile,
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  logout,
  getMe,
} from "../controllers/partner.auth.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/logout", logout); // No auth check — just clears the cookie

// Protected routes (requires valid partner_token cookie)
router.get("/me", protectPartner, getMe);
router.get("/profile", protectPartner, getProfile);
router.put("/profile", protectPartner, updateProfile);
router.put("/complete-profile", protectPartner, completeProfile);
router.post("/profile-photo", protectPartner, upload.single("file"), uploadProfilePhoto);

export default router;
