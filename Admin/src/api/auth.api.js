import api from './axiosInstance'

/**
 * Auth API — wraps /api/admin endpoints.
 * All functions return the axios response.data directly
 * (the interceptor handles errors centrally).
 */

/** POST /api/admin/login — { email, password } */
export const loginAdmin = (credentials) =>
  api.post('/admin/login', credentials).then((res) => res.data)

/** POST /api/admin/logout — clears the httpOnly cookie server-side */
export const logoutAdmin = () =>
  api.post('/admin/logout').then((res) => res.data)

/** GET /api/admin/me — returns the currently authenticated admin */
export const getMe = () =>
  api.get('/admin/me').then((res) => res.data)
