import api from './axiosInstance'

/**
 * Dashboard API — aggregates data from multiple partner endpoints
 * to power the summary cards and charts on the dashboard.
 *
 * The backend doesn't have a dedicated /dashboard endpoint yet,
 * so we derive stats client-side from the partners list.
 * When a real /dashboard endpoint is added, swap these calls out here
 * without touching any component.
 */

/**
 * Fetch partner stats by querying partners with different
 * verificationStatus values. Runs all queries in parallel.
 */
export const getDashboardStats = async () => {
  const [allRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
    api.get('/admin/partners', { params: { limit: 1 } }),
    api.get('/admin/partners', { params: { limit: 1, verificationStatus: 'Pending' } }),
    api.get('/admin/partners', { params: { limit: 1, verificationStatus: 'Approved' } }),
    api.get('/admin/partners', { params: { limit: 1, verificationStatus: 'Rejected' } }),
  ])

  return {
    totalPartners:   allRes.data.pagination.total,
    pendingPartners: pendingRes.data.pagination.total,
    approvedPartners: approvedRes.data.pagination.total,
    rejectedPartners: rejectedRes.data.pagination.total,
  }
}

/**
 * Fetch the latest N registered partners for the "Recent Activity" feed.
 */
export const getLatestPartners = (limit = 5) =>
  api
    .get('/admin/partners', { params: { limit, sortBy: 'createdAt', sortOrder: 'desc' } })
    .then((res) => res.data.partners)

/**
 * Fetch the latest N partners under review for the "Latest Verifications" feed.
 */
export const getLatestPendingVerifications = (limit = 5) =>
  api
    .get('/admin/partners/pending', { params: { limit } })
    .then((res) => res.data.partners)
