import { cn } from '@/utils/cn'

/**
 * PageHeader — consistent page title + subtitle + optional actions slot.
 * Used at the top of every dashboard page for visual consistency.
 *
 * Props:
 *   title       — main heading
 *   subtitle    — optional description
 *   actions     — optional ReactNode rendered on the right (buttons, badges)
 *   className
 */
const PageHeader = ({ title, subtitle, actions, className }) => (
  <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3', className)}>
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-slate-800 truncate">{title}</h1>
      {subtitle && (
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      )}
    </div>
    {actions && (
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        {actions}
      </div>
    )}
  </div>
)

export default PageHeader
