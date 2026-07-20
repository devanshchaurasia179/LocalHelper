import Category from "../../models/Category.js";

// ─── LIST ────────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/categories
 * Query params: search (name substring), isActive (boolean string)
 * Returns all categories (both active and inactive) for admin management.
 */
export const listCategories = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const filter = {};

    if (isActive === "true") filter.isActive = true;
    if (isActive === "false") filter.isActive = false;

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const categories = await Category.find(filter).sort({ name: 1 }).lean();

    return res.status(200).json({
      total: categories.length,
      categories,
    });
  } catch (error) {
    console.error("listCategories error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET BY ID ───────────────────────────────────────────────────────────────
/**
 * GET /api/admin/categories/:id
 */
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    return res.status(200).json({ category });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID." });
    }
    console.error("getCategoryById error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── CREATE ──────────────────────────────────────────────────────────────────
/**
 * POST /api/admin/categories
 * Body: { name*, description, icon }
 */
export const createCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required." });
    }

    // Check for duplicate name
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existing) {
      return res.status(409).json({ message: "A category with this name already exists." });
    }

    const category = await Category.create({
      name: name.trim(),
      description: description?.trim() || undefined,
      icon: icon?.trim() || undefined,
    });

    return res.status(201).json({
      message: "Category created successfully.",
      category,
    });
  } catch (error) {
    console.error("createCategory error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/categories/:id
 * Body: { name, description, icon }
 */
export const updateCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    // If name is changing, check for duplicate
    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne({
        _id: { $ne: category._id },
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      });

      if (existing) {
        return res.status(409).json({ message: "A category with this name already exists." });
      }

      category.name = name.trim();
    }

    if (description !== undefined) category.description = description?.trim() || "";
    if (icon !== undefined) category.icon = icon?.trim() || "";

    await category.save();

    return res.status(200).json({
      message: "Category updated successfully.",
      category,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID." });
    }
    console.error("updateCategory error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── TOGGLE ACTIVE ───────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/categories/:id/toggle
 * Flips isActive: true → false or false → true.
 */
export const toggleCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    category.isActive = !category.isActive;
    await category.save();

    return res.status(200).json({
      message: `Category ${category.isActive ? "enabled" : "disabled"} successfully.`,
      category: {
        _id: category._id,
        name: category.name,
        isActive: category.isActive,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID." });
    }
    console.error("toggleCategory error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────────
/**
 * DELETE /api/admin/categories/:id
 * Hard delete — only allowed if no partners reference this category.
 */
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    // Check if any partners are using this category
    const Partner = (await import("../../models/partner/Partner.js")).default;
    const partnerCount = await Partner.countDocuments({
      categories: category._id,
    });

    if (partnerCount > 0) {
      return res.status(409).json({
        message: `Cannot delete "${category.name}" — ${partnerCount} partner${partnerCount > 1 ? "s" : ""} ${partnerCount > 1 ? "are" : "is"} using this category. Disable it instead.`,
      });
    }

    await Category.findByIdAndDelete(category._id);

    return res.status(200).json({
      message: "Category deleted successfully.",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID." });
    }
    console.error("deleteCategory error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
