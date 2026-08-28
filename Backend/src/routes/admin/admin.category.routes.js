import { Router } from "express";
import multer from "multer";
import { protectAdmin } from "../../middleware/admin.auth.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";
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

/**
 * uploadImage — wraps upload.single("image") so multer errors (wrong file
 * type, file too large) return a clean JSON 400 instead of an HTML 500.
 * The "image" field is optional; requests without a file pass straight through.
 */
const uploadImage = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image must be 5 MB or smaller." });
      }
      return res.status(400).json({ message: err.message || "Image upload failed." });
    }
    next();
  });
};

// All routes require admin auth
router.use(protectAdmin);

// Category routes
router.get("/", listCategories);
router.get("/:id", getCategoryById);
router.post("/", createCategory);
router.patch("/:id", updateCategory);
router.patch("/:id/toggle", toggleCategory);
router.delete("/:id", deleteCategory);

// Subcategory routes — accept an optional image upload under the "image" field
router.post("/:id/subcategories", uploadImage, addSubcategory);
router.patch("/:id/subcategories/:subId", uploadImage, updateSubcategory);
router.delete("/:id/subcategories/:subId", deleteSubcategory);

export default router;
