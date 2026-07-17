import { cn } from '@/utils/cn'
import { TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import Skeleton from './Skeleton'

/**
 * StatCard — metric card shown on the dashboard.
 *
 * Props:
 *   title       — label text
 *   value       — main number / string
 *   icon        — Lucide icon component
 *   iconColor   — Tailwind bg class for the icon container (e.g. 'bg-primary-50')
 *   iconTextColor — Tailwind text class for the icon (e.g. 'text-primary-600')
 *   trend       — optional { value: number, label: string }
 *   loading     — show skeleton
 *   className
 */
const StatCard = ({
  title,
  value,
  icon: Icon,
  iconColor   = 'bg-primary-50',
  iconTextColor = 'text-primary-600',
  trend,
  loading = false,
  className,
}) => {
  if (loading) return <Skeleton.StatCard />

  return (
    <motion.div
      className={cn(
        'bg-white rounded-2xl border border-slate-100 shadow-card p-6',
        className
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={cn('p-2.5 rounded-xl', iconColor)}>
          <Icon className={cn('w-5 h-5', iconTextColor)} aria-hidden="true" />
        </div>
      </div>

      <p className="text-3xl font-bold text-slate-800 tabular-nums">{value}</p>

      {trend && (
        <div className="flex items-center gap-1.5 mt-2">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
          <span className="text-xs text-emerald-600 font-medium">+{trend.value}%</span>
          <span className="text-xs text-slate-400">{trend.label}</span>
        </div>
      )}
    </motion.div>
  )
}

export default StatCard
