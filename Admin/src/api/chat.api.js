import api from './axiosInstance'

/**
 * Admin Chat API — wraps /api/admin/conversations endpoints.
 */

/**
 * GET /api/admin/conversations
 * @param {Object} params — page, limit, status
 */
export const getAllConversations = (params = {}) =>
  api.get('/admin/conversations', { params }).then((res) => res.data)

/**
 * GET /api/admin/partners/:partnerId/conversations
 * @param {string} partnerId
 * @param {Object} params — page, limit
 */
export const getPartnerConversations = (partnerId, params = {}) =>
  api.get(`/admin/partners/${partnerId}/conversations`, { params }).then((res) => res.data)

/**
 * GET /api/admin/conversations/:conversationId/messages
 * @param {string} conversationId
 * @param {Object} params — page, limit
 */
export const getConversationMessages = (conversationId, params = {}) =>
  api.get(`/admin/conversations/${conversationId}/messages`, { params }).then((res) => res.data)

/**
 * PATCH /api/admin/conversations/:conversationId/close
 */
export const closeConversation = (conversationId) =>
  api.patch(`/admin/conversations/${conversationId}/close`).then((res) => res.data)
