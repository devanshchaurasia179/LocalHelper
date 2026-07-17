import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Skeleton from '@/components/ui/Skeleton'

/**
 * ProtectedRoute — guards all dashboard routes.
 *
 * While the session check is in-flight (isLoading = true) we show a
 * full-screen skeleton so the user never sees a flash of the login page.
 *
 * Once resolved:
 *   - isAuthenticated → render children (via <Outlet />)
 *   - not authenticated → redirect to /login, preserving the attempted URL
 *     in location state so we can redirect back after login.
 */
const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="space-y-3 w-full max-w-xs px-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
