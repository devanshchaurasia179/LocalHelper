import { api } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface CategoriesResponse {
  categories: Category[];
}

// ─── API call ─────────────────────────────────────────────────────────────────

/** GET /api/categories — returns all active categories */
export const fetchCategories = () =>
  api.get<CategoriesResponse>("/categories");
