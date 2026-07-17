import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * SearchBar — debounced search input.
 * Calls onChange only after the user stops typing for `delay` ms.
 * This prevents firing an API request on every keystroke.
 *
 * Props:
 *   value        — controlled value
 *   onChange(v)  — debounced callback
 *   placeholder
 *   delay        — debounce ms (default 400)
 *   className
 */
const SearchBar = ({
  value = '',
  onChange,
  placeholder = 'Search...',
  delay = 400,
  className,
}) => {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef(null)

  // Sync if parent resets the value
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (e) => {
    const v = e.target.value
    setLocalValue(v)

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange?.(v)
    }, delay)
  }

  const handleClear = () => {
    setLocalValue('')
    clearTimeout(timerRef.current)
    onChange?.('')
  }

  return (
    <div className={cn('relative', className)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400
          hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
        aria-label={placeholder}
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export default SearchBar
