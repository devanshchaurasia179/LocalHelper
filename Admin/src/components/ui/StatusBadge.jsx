import { cn } from '@/utils/cn'

/**
 * StatusBadge — colored pill used to show verificationStatus / accountStatus.
 *
 * variant: 'success' | 'danger' | 'warning' | 'info' | 'default'
 * size:    'sm' | 'md'
 */
const VARIANTS = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  danger:  'bg-red-50    text-red-700     ring-1 ring-red-200',
  warning: 'bg-amber-50  text-amber-700   ring-1 ring-amber-200',
  info:    'bg-blue-50   text-blue-700    ring-1 ring-blue-200',
  default: 'bg-slate-100 text-slate-600   ring-1 ring-slate-200',
}

const DOT_COLORS = {
  success: 'bg-emerald-500',
  danger:  'bg-red-500',
  warning: 'bg-amber-500',
  info:    'bg-blue-500',
  default: 'bg-slate-400',
}

const SIZES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
}

const StatusBadge = ({ label, variant = 'default', size = 'sm', showDot = true, className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        VARIANTS[variant] || VARIANTS.default,
        SIZES[size] || SIZES.sm,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            DOT_COLORS[variant] || DOT_COLORS.default
          )}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  )
}

export default StatusBadge
