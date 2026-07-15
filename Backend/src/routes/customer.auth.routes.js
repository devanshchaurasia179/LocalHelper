import express from "express";
import {
  sendOtp,
  verifyOtp,
  completeProfile,
  updateProfile,
  addAddress,
  updateAddress,
  getMe,
  logout,
} from "../controllers/customer.auth.controller.js";
import protectCustomer from "../middleware/customer.auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

// Protected routes (requires valid customer_token cookie)
router.get("/me", protectCustomer, getMe);
router.put("/complete-profile", protectCustomer, completeProfile);
router.patch("/update-profile", protectCustomer, updateProfile);
router.post("/add-address", protectCustomer, addAddress);
router.patch("/update-address/:addressId", protectCustomer, updateAddress);
router.post("/logout", protectCustomer, logout);

export default router;
