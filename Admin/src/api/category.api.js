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

// ── Subcategory Management ──────────────────────────────────────────

/**
 * Build a multipart FormData payload from a subcategory data object.
 * The `image` field, when present, must be a browser File/Blob.
 * Undefined / null values are skipped so we don't overwrite with "undefined".
 */
const buildSubcategoryFormData = (data) => {
  const fd = new FormData()
  if (data.name !== undefined) fd.append('name', data.name)
  if (data.description !== undefined && data.description !== null)
    fd.append('description', data.description)
  if (data.icon !== undefined && data.icon !== null) fd.append('icon', data.icon)
  if (data.isActive !== undefined) fd.append('isActive', String(data.isActive))
  if (data.image instanceof File || data.image instanceof Blob)
    fd.append('image', data.image)
  // Explicit removal of an existing image
  if (data.image === null) fd.append('removeImage', 'true')
  return fd
}

/**
 * POST /api/admin/categories/:id/subcategories
 * Body (multipart): { name*, description, icon, image? }
 * Uploaded via multer on the backend. Content-Type is left undefined so axios
 * generates the correct multipart/form-data header with a boundary.
 * Response: { message, category }
 */
export const addSubcategory = (categoryId, data) =>
  api
    .post(`/admin/categories/${categoryId}/subcategories`, buildSubcategoryFormData(data), {
      headers: { 'Content-Type': undefined },
    })
    .then((res) => res.data)

/**
 * PATCH /api/admin/categories/:id/subcategories/:subId
 * Body (multipart): { name, description, icon, isActive, image? }
 * Response: { message, category }
 */
export const updateSubcategory = (categoryId, subId, data) =>
  api
    .patch(
      `/admin/categories/${categoryId}/subcategories/${subId}`,
      buildSubcategoryFormData(data),
      { headers: { 'Content-Type': undefined } }
    )
    .then((res) => res.data)

/**
 * DELETE /api/admin/categories/:id/subcategories/:subId
 * Hard delete — blocked if partners reference this subcategory.
 * Response: { message, category }
 */
export const deleteSubcategory = (categoryId, subId) =>
  api.delete(`/admin/categories/${categoryId}/subcategories/${subId}`).then((res) => res.data)
