import express from "express";
import Category from "../models/Category.js";

const router = express.Router();

// GET /api/categories — returns all active categories with subcategories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("name description icon subcategories");
    
    // Filter only active subcategories
    const categoriesWithActiveSubcategories = categories.map(category => ({
      ...category.toObject(),
      subcategories: category.subcategories.filter(sub => sub.isActive)
    }));
    
    return res.status(200).json({ categories: categoriesWithActiveSubcategories });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
});

// GET /api/categories/:id — returns a specific category with subcategories
router.get("/:id", async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, isActive: true })
      .select("name description icon subcategories");
    
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }
    
    // Filter only active subcategories
    const categoryWithActiveSubcategories = {
      ...category.toObject(),
      subcategories: category.subcategories.filter(sub => sub.isActive)
    };
    
    return res.status(200).json({ category: categoryWithActiveSubcategories });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID." });
    }
    return res.status(500).json({ message: "Internal server error." });
  }
});

export default router;
