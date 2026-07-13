import { api } from "./api";

// GET /categories
export const getCategories = () => api.get("/categories");
