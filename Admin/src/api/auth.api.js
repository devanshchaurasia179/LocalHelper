import api, { saveToken, removeToken } from './axiosInstance'

/** POST /api/admin/login — { email, password } */
export const loginAdmin = async (credentials) => {
  const data = await api.post('/admin/login', credentials).then((res) => res.data)
  // Persist the JWT so subsequent requests can attach it as a Bearer token
  if (data.token) saveToken(data.token)
  return data
}

/** POST /api/admin/logout — clears cookie server-side and removes local token */
export const logoutAdmin = async () => {
  const data = await api.post('/admin/logout').then((res) => res.data)
  removeToken()
  return data
}

/** GET /api/admin/me — returns the currently authenticated admin */
export const getMe = () =>
  api.get('/admin/me').then((res) => res.data)
