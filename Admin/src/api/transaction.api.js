import api from './axiosInstance'

/**
 * Transaction API — wraps admin transaction endpoints.
 *
 * Routes:
 *   GET    /api/admin/partners/:partnerId/transactions
 *   PATCH  /api/admin/transactions/:id/process
 *   POST   /api/admin/partners/:partnerId/transactions/adjust
 */

// ── Partner transaction history ────────────────────────────────────

/**
 * GET /api/admin/partners/:partnerId/transactions
 * @param {string} partnerId
 * @param {Object} params — type, status, page, limit, startDate, endDate
 */
export const getPartnerTransactions = (partnerId, params = {}) =>
  api
    .get(`/admin/partners/${partnerId}/transactions`, { params })
    .then((res) => res.data)

// ── Payout queue (all partners, pending/processing payouts) ────────

/**
 * GET /api/admin/partners/:partnerId/transactions?type=payout&status=pending
 * Convenience wrapper — returns only the pending payout queue for a partner.
 */
export const getPendingPayouts = (partnerId, params = {}) =>
  getPartnerTransactions(partnerId, { ...params, type: 'payout', status: 'pending' })

// ── Process a payout ───────────────────────────────────────────────

/**
 * PATCH /api/admin/transactions/:id/process
 * @param {string} transactionId
 * @param {{ status: 'completed'|'failed', failureReason?: string }} body
 */
export const processPayout = (transactionId, body) =>
  api
    .patch(`/admin/transactions/${transactionId}/process`, body)
    .then((res) => res.data)

// ── Manual balance adjustment ──────────────────────────────────────

/**
 * POST /api/admin/partners/:partnerId/transactions/adjust
 * @param {string} partnerId
 * @param {{ amount: number, direction: 'credit'|'debit', description: string }} body
 */
export const adjustBalance = (partnerId, body) =>
  api
    .post(`/admin/partners/${partnerId}/transactions/adjust`, body)
    .then((res) => res.data)
