import { cn } from '@/utils/cn'

/**
 * Skeleton — animated placeholder shown while data is loading.
 * Use width/height props or className to size it.
 */
const Skeleton = ({ className, ...props }) => (
  <div
    className={cn('animate-pulse bg-slate-200 rounded-lg', className)}
    aria-hidden="true"
    {...props}
  />
)

/** Pre-built skeleton for a stat card */
Skeleton.StatCard = () => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-10 rounded-xl" />
    </div>
    <Skeleton className="h-8 w-20" />
    <Skeleton className="h-3 w-36" />
  </div>
)

/** Pre-built skeleton for a table row */
Skeleton.TableRow = ({ cols = 6 }) => (
  <tr className="border-b border-slate-100">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3.5">
        <Skeleton className="h-4 w-full max-w-[120px]" />
      </td>
    ))}
  </tr>
)

/** Pre-built skeleton for a partner card in the detail view */
Skeleton.DetailCard = () => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton className="h-16 w-16 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  </div>
)

export default Skeleton
