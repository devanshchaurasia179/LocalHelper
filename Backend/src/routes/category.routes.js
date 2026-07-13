import express from "express";
import Category from "../models/Category.js";

const router = express.Router();

// GET /api/categories — returns all active categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).select("name description icon");
    return res.status(200).json({ categories });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
});

export default router;
