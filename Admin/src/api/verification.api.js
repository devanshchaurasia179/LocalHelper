import api from './axiosInstance'

/**
 * Verification API — wraps /api/admin/verification endpoints.
 *
 * This is the new dynamic verification system, separate from the legacy
 * partner-level approve/reject on /api/admin/partners/:id.
 *
 * The new system operates at the document level:
 *   - Each document can be approved or rejected individually
 *   - The overall session status is auto-promoted when all required docs pass
 *   - Force-approve / force-reject bypasses the auto-promotion logic
 */

// ── Pending queue ───────────────────────────────────────────────────

/**
 * GET /api/admin/verification/pending
 * Returns partners whose VerificationSession.overallStatus === "Under Review".
 * Sorted FIFO — oldest submission first.
 *
 * Response: { partners: [{ sessionId, sessionNumber, submittedAt, partner }], pagination }
 */
export const getPendingVerifications = (params = {}) =>
  api.get('/admin/verification/pending', { params }).then((res) => res.data)

// ── Partner verification detail ─────────────────────────────────────

/**
 * GET /api/admin/verification/:partnerId
 * Full verification detail view: partner profile + session + documents[].
 *
 * Response: { partner, session, summary, documents[] }
 *
 * Each document in documents[] contains:
 *   documentId, documentTypeId, key, side, title, icon, isRequired,
 *   status, previewUrl, numberValue, uploadedAt, version, reuploadCount,
 *   fileFormat, fileBytes, approvedBy, approvedAt, rejectedBy, rejectedAt,
 *   rejectionReason
 */
export const getVerificationDetail = (partnerId) =>
  api.get(`/admin/verification/${partnerId}`).then((res) => res.data)

// ── Document-level actions ──────────────────────────────────────────

/**
 * PATCH /api/admin/verification/:partnerId/documents/:documentId/approve
 * Body: { note? }
 * Response: { message, documentId, documentStatus, overallStatus, autoPromoted }
 */
export const approveDocument = (partnerId, documentId, note = '') =>
  api
    .patch(`/admin/verification/${partnerId}/documents/${documentId}/approve`, { note })
    .then((res) => res.data)

/**
 * PATCH /api/admin/verification/:partnerId/documents/:documentId/reject
 * Body: { reason }  — required, min 10 chars
 * Response: { message, documentId, documentStatus, rejectionReason, overallStatus }
 */
export const rejectDocument = (partnerId, documentId, reason) =>
  api
    .patch(`/admin/verification/${partnerId}/documents/${documentId}/reject`, { reason })
    .then((res) => res.data)

// ── Overall verification actions ────────────────────────────────────

/**
 * PATCH /api/admin/verification/:partnerId/approve
 * Force-approves the entire verification session.
 * Body: { note? }
 * Response: { message, partnerId, overallStatus, verifiedBy, verifiedAt }
 */
export const forceApproveVerification = (partnerId, note = '') =>
  api
    .patch(`/admin/verification/${partnerId}/approve`, { note })
    .then((res) => res.data)

/**
 * PATCH /api/admin/verification/:partnerId/reject
 * Force-rejects the entire verification session.
 * Body: { reason }  — required, min 10 chars
 * Response: { message, partnerId, overallStatus, rejectionReason, rejectedBy, rejectedAt }
 */
export const forceRejectVerification = (partnerId, reason) =>
  api
    .patch(`/admin/verification/${partnerId}/reject`, { reason })
    .then((res) => res.data)
