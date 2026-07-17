import { cn } from '@/utils/cn'
import { SearchX, InboxIcon } from 'lucide-react'
import Button from './Button'

/**
 * EmptyState — shown when a list/table has no results.
 * Handles both "no data at all" and "no results for this search" cases.
 */
const EmptyState = ({
  icon: Icon = InboxIcon,
  title = 'Nothing here yet',
  description,
  action,
  className,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center py-16 px-6 text-center',
      className
    )}
    role="status"
    aria-label={title}
  >
    <div className="p-4 rounded-full bg-slate-100 mb-4">
      <Icon className="w-8 h-8 text-slate-400" aria-hidden="true" />
    </div>
    <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-slate-500 max-w-xs">{description}</p>
    )}
    {action && (
      <div className="mt-4">
        {typeof action === 'function' ? (
          <Button variant="secondary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : (
          action
        )}
      </div>
    )}
  </div>
)

/** Specific variant for "no search results" */
EmptyState.NoResults = ({ onClear }) => (
  <EmptyState
    icon={SearchX}
    title="No results found"
    description="Try adjusting your search or filter to find what you're looking for."
    action={onClear ? { label: 'Clear filters', onClick: onClear } : undefined}
  />
)

export default EmptyState
