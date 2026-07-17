import api from './axiosInstance'

/**
 * Partner API — wraps /api/admin/partners endpoints.
 *
 * Naming convention: each function maps 1:1 to a backend route so it's
 * easy to find what you're looking for.
 */

// ── List / Read ────────────────────────────────────────────────────

/**
 * GET /api/admin/partners
 * @param {Object} params — page, limit, search, verificationStatus,
 *                          accountStatus, city, sortBy, sortOrder
 */
export const getAllPartners = (params = {}) =>
  api.get('/admin/partners', { params }).then((res) => res.data)

/**
 * GET /api/admin/partners/pending
 * @param {Object} params — page, limit
 */
export const getPendingPartners = (params = {}) =>
  api.get('/admin/partners/pending', { params }).then((res) => res.data)

/**
 * GET /api/admin/partners/:id — full partner profile
 */
export const getPartnerById = (id) =>
  api.get(`/admin/partners/${id}`).then((res) => res.data)

// ── Verification ───────────────────────────────────────────────────

/** PATCH /api/admin/partners/:id/approve */
export const approvePartner = (id) =>
  api.patch(`/admin/partners/${id}/approve`).then((res) => res.data)

/** PATCH /api/admin/partners/:id/reject — body: { reason } */
export const rejectPartner = (id, reason) =>
  api.patch(`/admin/partners/${id}/reject`, { reason }).then((res) => res.data)

// ── Account management ─────────────────────────────────────────────

/** PATCH /api/admin/partners/:id/block — body: { reason? } */
export const blockPartner = (id, reason) =>
  api.patch(`/admin/partners/${id}/block`, { reason }).then((res) => res.data)

/** PATCH /api/admin/partners/:id/unblock */
export const unblockPartner = (id) =>
  api.patch(`/admin/partners/${id}/unblock`).then((res) => res.data)

/** PATCH /api/admin/partners/:id/suspend — body: { reason } */
export const suspendPartner = (id, reason) =>
  api.patch(`/admin/partners/${id}/suspend`, { reason }).then((res) => res.data)

/** PATCH /api/admin/partners/:id/reactivate */
export const reactivatePartner = (id) =>
  api.patch(`/admin/partners/${id}/reactivate`).then((res) => res.data)

/** DELETE /api/admin/partners/:id — SUPER_ADMIN only */
export const deletePartner = (id) =>
  api.delete(`/admin/partners/${id}`).then((res) => res.data)
