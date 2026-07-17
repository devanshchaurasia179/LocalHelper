import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Pagination — page controls for tables.
 * Shows at most 5 page buttons at a time, with ellipsis for large sets.
 *
 * Props:
 *   page        — current page (1-indexed)
 *   totalPages  — total number of pages
 *   total       — total record count (for "X of Y" display)
 *   limit       — records per page
 *   onPageChange(newPage) — callback
 */
const Pagination = ({ page, totalPages, total, limit, onPageChange }) => {
  if (totalPages <= 1) return null

  const from = (page - 1) * limit + 1
  const to   = Math.min(page * limit, total)

  // Build visible page numbers with ellipsis
  const getPages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages]
    }
    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [1, '...', page - 1, page, page + 1, '...', totalPages]
  }

  const pages = getPages()

  const btnBase =
    'inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-lg text-sm font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
      {/* Record count */}
      <p className="text-sm text-slate-500 order-2 sm:order-1">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span> results
      </p>

      {/* Page buttons */}
      <nav
        className="flex items-center gap-1 order-1 sm:order-2"
        aria-label="Pagination"
      >
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={cn(btnBase, 'text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed')}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              disabled={p === page}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                btnBase,
                p === page
                  ? 'bg-primary-600 text-white shadow-sm cursor-default'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={cn(btnBase, 'text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed')}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </nav>
    </div>
  )
}

export default Pagination
