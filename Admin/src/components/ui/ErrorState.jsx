import { AlertCircle, RefreshCw } from 'lucide-react'
import Button from './Button'

/**
 * ErrorState — shown when a query fails.
 * Provides a retry button that calls the React Query refetch function.
 */
const ErrorState = ({ message = 'Something went wrong.', onRetry, className }) => (
  <div
    className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className || ''}`}
    role="alert"
  >
    <div className="p-4 rounded-full bg-red-50 mb-4">
      <AlertCircle className="w-7 h-7 text-red-400" aria-hidden="true" />
    </div>
    <p className="text-sm font-semibold text-slate-700 mb-1">Failed to load data</p>
    <p className="text-sm text-slate-400 max-w-xs mb-4">{message}</p>
    {onRetry && (
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        onClick={onRetry}
      >
        Try again
      </Button>
    )}
  </div>
)

export default ErrorState
