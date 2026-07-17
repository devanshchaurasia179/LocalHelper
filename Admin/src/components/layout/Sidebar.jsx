import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  UserCheck,
  CalendarDays,
  Wrench,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { label: 'Dashboard',    to: '/dashboard',    icon: LayoutDashboard },
  { label: 'Partners',     to: '/partners',     icon: Users },
  { label: 'Verification', to: '/verification', icon: ShieldCheck },
  { label: 'Customers',    to: '/customers',    icon: UserCheck },
  { label: 'Bookings',     to: '/bookings',     icon: CalendarDays },
  { label: 'Services',     to: '/services',     icon: Wrench },
  { label: 'Payments',     to: '/payments',     icon: CreditCard },
  { label: 'Analytics',    to: '/analytics',    icon: BarChart3 },
  { label: 'Settings',     to: '/settings',     icon: Settings },
]

/**
 * Sidebar — responsive navigation panel.
 *
 * Desktop: collapsible icon-only / full-width modes.
 * Mobile:  slides in as an overlay panel when `isOpen` is true.
 *
 * Props:
 *   collapsed     — desktop collapse state
 *   onCollapse()  — toggle desktop collapse
 *   isMobileOpen  — mobile drawer state
 *   onMobileClose — close mobile drawer
 */
const Sidebar = ({ collapsed, onCollapse, isMobileOpen, onMobileClose }) => {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/login', { replace: true })
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-slate-100 flex-shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate leading-tight">LocalHelpers</p>
              <p className="text-xs text-slate-400 leading-tight">Admin Panel</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2" aria-label="Main navigation">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                    'transition-all duration-150 group',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
                    collapsed && 'justify-center px-2'
                  )
                }
                title={collapsed ? label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'w-5 h-5 flex-shrink-0 transition-colors',
                        isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'
                      )}
                      aria-hidden="true"
                    />
                    {!collapsed && <span className="truncate">{label}</span>}
                    {/* Active indicator bar */}
                    {isActive && !collapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom: admin info + collapse + logout */}
      <div className="border-t border-slate-100 p-3 space-y-1 flex-shrink-0">
        {/* Collapse toggle — desktop only */}
        <button
          onClick={onCollapse}
          className="hidden lg:flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 flex-shrink-0 mx-auto" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium',
            'text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors group',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span>Logout</span>}
        </button>

        {/* Admin info */}
        {!collapsed && admin && (
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-700">
                {admin.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{admin.name}</p>
              <p className="text-xs text-slate-400 truncate">{admin.role}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <motion.aside
        className={cn(
          'hidden lg:flex flex-col h-full bg-white border-r border-slate-100 overflow-hidden',
          'transition-all duration-300 ease-in-out flex-shrink-0'
        )}
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        aria-label="Sidebar navigation"
      >
        {sidebarContent}
      </motion.aside>

      {/* ── Mobile drawer ───────────────────────────────── */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="lg:hidden fixed inset-0 z-40 bg-slate-900/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              aria-hidden="true"
            />
            {/* Drawer */}
            <motion.aside
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col shadow-2xl"
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              aria-label="Mobile navigation"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default Sidebar
