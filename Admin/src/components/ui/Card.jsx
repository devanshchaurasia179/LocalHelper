import { cn } from '@/utils/cn'

/**
 * Card — white rounded container with soft shadow.
 * Used for stat cards, section containers, modals, etc.
 */

const Card = ({ children, className, ...props }) => (
  <div
    className={cn(
      'bg-white rounded-2xl border border-slate-100 shadow-card',
      className
    )}
    {...props}
  >
    {children}
  </div>
)

/** Card.Header — optional top section with bottom border */
Card.Header = ({ children, className, ...props }) => (
  <div
    className={cn('px-6 py-4 border-b border-slate-100', className)}
    {...props}
  >
    {children}
  </div>
)

/** Card.Body — padded content area */
Card.Body = ({ children, className, ...props }) => (
  <div className={cn('px-6 py-5', className)} {...props}>
    {children}
  </div>
)

/** Card.Footer — optional bottom section with top border */
Card.Footer = ({ children, className, ...props }) => (
  <div
    className={cn('px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl', className)}
    {...props}
  >
    {children}
  </div>
)

export default Card
