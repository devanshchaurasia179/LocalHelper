import { api } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Subcategory {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  /** Admin-uploaded image (Cloudinary) shown in the app */
  image?: { url?: string; publicId?: string };
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  subcategories?: Subcategory[];
}

export interface CategoriesResponse {
  categories: Category[];
}

// ─── API call ─────────────────────────────────────────────────────────────────

/** GET /api/categories — returns all active categories */
export const fetchCategories = () =>
  api.get<CategoriesResponse>("/categories");
