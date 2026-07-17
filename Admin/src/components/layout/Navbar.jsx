import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, Bell, ChevronDown, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/utils/formatters'
import { cn } from '@/utils/cn'
import Avatar from '@/components/ui/Avatar'

/**
 * Map route paths to human-readable breadcrumb labels.
 * Dynamic segments like /partners/:id get resolved to "Partner Details".
 */
const ROUTE_MAP = {
  '/dashboard':   ['Dashboard'],
  '/partners':    ['Partners'],
  '/verification': ['Verification'],
  '/customers':   ['Customers'],
  '/bookings':    ['Bookings'],
  '/services':    ['Services'],
  '/payments':    ['Payments'],
  '/analytics':   ['Analytics'],
  '/settings':    ['Settings'],
}

const getBreadcrumbs = (pathname) => {
  // /partners/abc123 → ['Partners', 'Partner Details']
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return ['Dashboard']

  const base = '/' + segments[0]
  const crumbs = ROUTE_MAP[base] || [segments[0].charAt(0).toUpperCase() + segments[0].slice(1)]

  if (segments.length > 1) {
    crumbs.push('Partner Details')
  }

  return crumbs
}

/**
 * Navbar — sticky top bar.
 * Contains: hamburger (mobile), breadcrumbs, current date, notifications, admin avatar.
 *
 * Props:
 *   onMenuClick — opens mobile sidebar
 */
const Navbar = ({ onMenuClick }) => {
  const { admin } = useAuth()
  const location  = useLocation()
  const breadcrumbs = getBreadcrumbs(location.pathname)
  const today     = formatDate(new Date().toISOString())

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-100 flex items-center px-4 md:px-6 gap-4 flex-shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 min-w-0 flex-1" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <span className="text-slate-300 flex-shrink-0" aria-hidden="true">/</span>
            )}
            <span
              className={cn(
                'text-sm truncate',
                i === breadcrumbs.length - 1
                  ? 'font-semibold text-slate-800'
                  : 'text-slate-400'
              )}
              aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Right section */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Current date — hidden on small screens */}
        <span className="hidden md:block text-xs text-slate-400 font-medium bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
          {today}
        </span>

        {/* Notifications button */}
        <button
          className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="View notifications"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
          {/* Notification dot — hardcoded for now */}
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"
            aria-hidden="true"
          />
        </button>

        {/* Admin profile pill */}
        <button
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
          aria-label="Admin profile"
        >
          <Avatar src={null} name={admin?.name || 'Admin'} size="sm" />
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-tight">{admin?.name || 'Admin'}</p>
            <p className="text-xs text-slate-400 leading-tight">{admin?.role || ''}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

export default Navbar
