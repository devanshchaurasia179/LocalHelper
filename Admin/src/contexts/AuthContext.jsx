import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getMe, logoutAdmin } from '@/api/auth.api'

/**
 * AuthContext
 *
 * Manages the currently authenticated admin session.
 * Authentication state is derived from the httpOnly cookie — we never
 * store the token in JS. On app boot we call GET /api/admin/me:
 *   ✓ 200 → admin is logged in, store profile
 *   ✗ 401 → not logged in, stay on /login
 *
 * Provides: { admin, isLoading, isAuthenticated, login, logout }
 */
const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null)
  const [isLoading, setIsLoading] = useState(true) // true until initial check resolves
  const queryClient = useQueryClient()

  // ── Bootstrap: check existing session on mount ─────────────────────
  const checkSession = useCallback(async () => {
    try {
      const data = await getMe()
      setAdmin(data.admin)
    } catch {
      // 401 from getMe means no valid cookie — that's fine on /login
      setAdmin(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  // ── Listen for 401/403 events fired by axios interceptor ──────────
  // This handles token expiry mid-session without needing to pass
  // the logout function into the axios instance (which would create
  // a circular dependency).
  useEffect(() => {
    const handleUnauthorized = () => {
      setAdmin(null)
      queryClient.clear() // wipe all cached data on auth failure
    }

    window.addEventListener('admin:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('admin:unauthorized', handleUnauthorized)
  }, [queryClient])

  // ── login: called by LoginPage after successful POST /login ────────
  // The backend already set the cookie; we just store the admin object.
  const login = useCallback((adminData) => {
    setAdmin(adminData)
  }, [])

  // ── logout: calls the backend to clear the cookie, then local state ─
  const logout = useCallback(async () => {
    try {
      await logoutAdmin()
    } catch {
      // Even if the network call fails, clear local state so the UI
      // reflects the logged-out state. The cookie will expire naturally.
    } finally {
      setAdmin(null)
      queryClient.clear()
    }
  }, [queryClient])

  const value = {
    admin,
    isLoading,
    isAuthenticated: !!admin,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth — convenience hook.
 * Throws if used outside <AuthProvider> to catch wiring bugs early.
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
