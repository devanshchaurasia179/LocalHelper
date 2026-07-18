import api from './axiosInstance'

/**
 * Document Type API — wraps /api/admin/document-types endpoints.
 *
 * Document types are the configuration layer for the verification system.
 * Admin creates/edits them here; the partner app reads them dynamically.
 * Nothing in the partner app is hardcoded — it reads from this collection.
 */

// ── Read ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/document-types
 * Query params: isActive (boolean string), search (label substring)
 * Response: { total, documentTypes[] }
 */
export const listDocumentTypes = (params = {}) =>
  api.get('/admin/document-types', { params }).then((res) => res.data)

/**
 * GET /api/admin/document-types/:id
 * Response: { documentType, stats: { activeUploads, canHardDelete } }
 */
export const getDocumentTypeById = (id) =>
  api.get(`/admin/document-types/${id}`).then((res) => res.data)

// ── Create ──────────────────────────────────────────────────────────

/**
 * POST /api/admin/document-types
 * Body: { key*, label*, description, helpText, uploadInstructions,
 *         hasNumberField, numberFieldLabel, numberFieldPlaceholder,
 *         numberFieldValidationRegex, numberFieldValidationMessage,
 *         acceptedFileTypes, maxFileSizeMB, isMultiPage, isRequired,
 *         requiredForCategories, icon, displayOrder }
 * Response: { message, documentType }
 */
export const createDocumentType = (data) =>
  api.post('/admin/document-types', data).then((res) => res.data)

// ── Update ──────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/document-types/:id
 * Partial update — key is immutable after creation.
 * Response: { message, documentType }
 */
export const updateDocumentType = (id, data) =>
  api.patch(`/admin/document-types/${id}`, data).then((res) => res.data)

/**
 * PATCH /api/admin/document-types/:id/toggle
 * Flip isActive: true → false or false → true.
 * Response: { message, documentType: { _id, key, label, isActive } }
 */
export const toggleDocumentType = (id) =>
  api.patch(`/admin/document-types/${id}/toggle`).then((res) => res.data)

/**
 * PATCH /api/admin/document-types/:id/order
 * Body: { displayOrder }
 * Response: { message, documentType: { _id, key, label, displayOrder } }
 */
export const updateDisplayOrder = (id, displayOrder) =>
  api.patch(`/admin/document-types/${id}/order`, { displayOrder }).then((res) => res.data)

// ── Sample image ────────────────────────────────────────────────────

/**
 * POST /api/admin/document-types/:id/sample-image
 * Content-Type: multipart/form-data, field: "sampleImage"
 * Response: { message, sampleImage: { url, publicId } }
 */
export const uploadSampleImage = (id, file) => {
  const formData = new FormData()
  formData.append('sampleImage', file)
  return api
    .post(`/admin/document-types/${id}/sample-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((res) => res.data)
}

/**
 * DELETE /api/admin/document-types/:id/sample-image
 * Response: { message }
 */
export const deleteSampleImage = (id) =>
  api.delete(`/admin/document-types/${id}/sample-image`).then((res) => res.data)

// ── Delete ──────────────────────────────────────────────────────────

/**
 * DELETE /api/admin/document-types/:id
 * SUPER_ADMIN only. Hard delete — only if no uploads reference this type.
 * Response: { message }
 */
export const deleteDocumentType = (id) =>
  api.delete(`/admin/document-types/${id}`).then((res) => res.data)
