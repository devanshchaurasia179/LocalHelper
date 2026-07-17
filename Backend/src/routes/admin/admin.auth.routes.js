import { Router } from "express";
import { login, logout, getMe } from "../../controllers/admin/admin.auth.controller.js";
import { protectAdmin } from "../../middleware/admin.auth.middleware.js";

const router = Router();

// Public routes — no auth required
router.post("/login", login);

// Protected routes — must be logged in
router.post("/logout", protectAdmin, logout);
router.get("/me", protectAdmin, getMe);

export default router;
