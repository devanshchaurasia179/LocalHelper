import axios from 'axios'

/**
 * Shared Axios instance for all admin API calls.
 *
 * baseURL: '/api' — Vite proxies this to http://localhost:5001/api in dev.
 *          In production, set VITE_API_BASE_URL to the real domain.
 *
 * withCredentials: true — CRITICAL. Tells the browser to include the
 *   httpOnly `admin_token` cookie on every request. Without this, the
 *   cookie is never sent and every protected route returns 401.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 s — fail fast rather than hang forever
})

// ── Request interceptor ────────────────────────────────────────────
// Currently a pass-through. Kept here so we can add auth headers,
// request IDs, or logging in one place later.
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

// ── Response interceptor ───────────────────────────────────────────
// Central error handling so every component doesn't repeat this logic.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status

    // 401 — token missing / expired → kick to login
    // 403 — valid token but insufficient role → same treatment
    if (status === 401 || status === 403) {
      // Fire a custom event so AuthContext can react without a circular import.
      window.dispatchEvent(new CustomEvent('admin:unauthorized', { detail: { status } }))
    }

    // 500 — surface a readable message instead of the raw axios error
    if (status === 500) {
      error.displayMessage = 'Server error. Please try again later.'
    }

    return Promise.reject(error)
  }
)

export default api
