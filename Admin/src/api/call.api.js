import api from './axiosInstance'

/**
 * Call API — wraps admin call endpoints.
 *
 * Routes:
 *   GET /api/admin/calls                   — list all calls
 *   GET /api/admin/calls/:callId/recording — get temporary signed URL for playback
 */

// ── List all calls ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/calls
 * @param {Object} params — page, limit, search, status, recordingStatus, sortBy, sortOrder
 */
export const getAllCalls = (params = {}) =>
  api
    .get('/admin/calls', { params })
    .then((res) => res.data)

// ── Get recording signed URL ───────────────────────────────────────────────────

/**
 * GET /api/admin/calls/:callId/recording
 * Returns a temporary signed URL for audio playback.
 * @param {string} callId
 */
export const getCallRecording = (callId) =>
  api
    .get(`/admin/calls/${callId}/recording`)
    .then((res) => res.data)
