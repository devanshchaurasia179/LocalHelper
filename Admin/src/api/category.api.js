import api from './axiosInstance'

/**
 * Category API — wraps /api/admin/categories endpoints.
 */

// ── Read ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/categories
 * Query params: search (name substring), isActive (boolean string)
 * Response: { total, categories[] }
 */
export const listCategories = (params = {}) =>
  api.get('/admin/categories', { params }).then((res) => res.data)

/**
 * GET /api/admin/categories/:id
 * Response: { category }
 */
export const getCategoryById = (id) =>
  api.get(`/admin/categories/${id}`).then((res) => res.data)

// ── Create ──────────────────────────────────────────────────────────

/**
 * POST /api/admin/categories
 * Body: { name*, description, icon }
 * Response: { message, category }
 */
export const createCategory = (data) =>
  api.post('/admin/categories', data).then((res) => res.data)

// ── Update ──────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/categories/:id
 * Partial update.
 * Response: { message, category }
 */
export const updateCategory = (id, data) =>
  api.patch(`/admin/categories/${id}`, data).then((res) => res.data)

/**
 * PATCH /api/admin/categories/:id/toggle
 * Flip isActive.
 * Response: { message, category: { _id, name, isActive } }
 */
export const toggleCategory = (id) =>
  api.patch(`/admin/categories/${id}/toggle`).then((res) => res.data)

// ── Delete ──────────────────────────────────────────────────────────

/**
 * DELETE /api/admin/categories/:id
 * Hard delete — blocked if partners reference this category.
 * Response: { message }
 */
export const deleteCategory = (id) =>
  api.delete(`/admin/categories/${id}`).then((res) => res.data)
