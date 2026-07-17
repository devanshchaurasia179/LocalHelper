import { Fragment } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * FilterDropdown — a native <select> styled to match the design system.
 * Using a native select keeps accessibility free — screen readers handle it,
 * keyboard navigation works out of the box, and it works on mobile.
 *
 * Props:
 *   value          — controlled value
 *   onChange(v)    — called with the new value string
 *   options        — [{ label, value }]
 *   placeholder    — shown when no option is selected
 *   className
 */
const FilterDropdown = ({ value, onChange, options = [], placeholder = 'All', className }) => {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value || undefined)}
        className={cn(
          'h-9 pl-3 pr-8 rounded-xl border border-slate-200 bg-white',
          'text-sm text-slate-700 appearance-none cursor-pointer',
          'hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          'transition-colors',
          !value && 'text-slate-400'
        )}
        aria-label={placeholder}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {/* Custom chevron overlay */}
      <ChevronDown
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  )
}

export default FilterDropdown
