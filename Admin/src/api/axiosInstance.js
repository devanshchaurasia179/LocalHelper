import axios from 'axios'

/**
 * Shared Axios instance for all admin API calls.
 *
 * Token strategy:
 *   - On login, the server returns the JWT in the response body.
 *   - We store it in localStorage under 'admin_token'.
 *   - Every request attaches it as `Authorization: Bearer <token>`.
 *
 * Why not httpOnly cookies?
 *   The app routes requests through a Vercel proxy which strips Set-Cookie
 *   headers from proxied responses, so cookies never reach the browser.
 *   Bearer tokens in localStorage are a practical alternative here.
 */

const TOKEN_KEY = 'admin_token'

export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const removeToken = () => localStorage.removeItem(TOKEN_KEY)

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// ── Request interceptor ────────────────────────────────────────────
// Attach the Bearer token on every outgoing request if one exists.
api.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor ───────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status

    if (status === 401 || status === 403) {
      window.dispatchEvent(new CustomEvent('admin:unauthorized', { detail: { status } }))
    }

    if (status === 500) {
      error.displayMessage = 'Server error. Please try again later.'
    }

    return Promise.reject(error)
  }
)

export default api
