import { Router } from "express";
import { protectAdmin } from "../../middleware/admin.auth.middleware.js";
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from "../../controllers/admin/admin.category.controller.js";

const router = Router();

// All routes require admin auth
router.use(protectAdmin);

// Category routes
router.get("/", listCategories);
router.get("/:id", getCategoryById);
router.post("/", createCategory);
router.patch("/:id", updateCategory);
router.patch("/:id/toggle", toggleCategory);
router.delete("/:id", deleteCategory);

// Subcategory routes
router.post("/:id/subcategories", addSubcategory);
router.patch("/:id/subcategories/:subId", updateSubcategory);
router.delete("/:id/subcategories/:subId", deleteSubcategory);

export default router;
