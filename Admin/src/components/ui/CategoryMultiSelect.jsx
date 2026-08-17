import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, X, Check, Search, Loader2, Folder, FolderOpen } from 'lucide-react'
import { listCategories } from '@/api/category.api'
import { cn } from '@/utils/cn'

/**
 * CategoryMultiSelect
 *
 * Two-level tree multi-select: categories (top level) and their subcategories.
 *
 * value shape: array of selection items, each either:
 *   { type: 'category',    categoryId }
 *   { type: 'subcategory', categoryId, subcategoryId }
 *
 * onChange(items) — called with the new array.
 *
 * Rules:
 *   - Selecting a whole category deselects any individually-picked subcategories
 *     of that category (because the whole category already covers them).
 *   - Selecting all subcategories of a category auto-upgrades to the whole category.
 *   - Deselecting a category that had all subs selected removes everything for it.
 *
 * Props:
 *   value          — current selection array (see shape above)
 *   onChange(v)    — called with new selection array
 *   label          — label above the control
 *   helperText     — small helper below
 *   placeholder    — shown when empty
 *   disabled
 */
const CategoryMultiSelect = ({
  value = [],
  onChange,
  label,
  helperText,
  placeholder = 'All categories (global)',
  disabled = false,
}) => {
  const [open, setOpen]               = useState(false)
  const [search, setSearch]           = useState('')
  const [expandedCats, setExpandedCats] = useState({})
  const containerRef = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategories(),
    staleTime: 60_000,
  })

  const categories = data?.categories?.filter((c) => c.isActive) || []

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isCategorySelected = useCallback(
    (catId) => value.some((v) => v.type === 'category' && v.categoryId === catId),
    [value]
  )

  const isSubcategorySelected = useCallback(
    (catId, subId) =>
      value.some(
        (v) =>
          v.type === 'subcategory' &&
          v.categoryId === catId &&
          v.subcategoryId === subId
      ),
    [value]
  )

  // Is the whole category implicitly covered (either directly or all subs ticked)?
  const isCategoryFullyCovered = useCallback(
    (cat) => {
      if (isCategorySelected(cat._id)) return true
      const activeSubs = (cat.subcategories || []).filter((s) => s.isActive)
      if (activeSubs.length === 0) return false
      return activeSubs.every((s) => isSubcategorySelected(cat._id, s._id))
    },
    [isCategorySelected, isSubcategorySelected]
  )

  const isPartiallySelected = useCallback(
    (cat) => {
      if (isCategorySelected(cat._id)) return false
      const activeSubs = (cat.subcategories || []).filter((s) => s.isActive)
      return activeSubs.some((s) => isSubcategorySelected(cat._id, s._id))
    },
    [isCategorySelected, isSubcategorySelected]
  )

  // ── Toggle handlers ───────────────────────────────────────────────────────
  const toggleCategory = useCallback(
    (cat) => {
      const catId = cat._id
      if (isCategoryFullyCovered(cat)) {
        // Remove the whole category + any individual sub selections for it
        onChange(
          value.filter(
            (v) => !(v.categoryId === catId)
          )
        )
      } else {
        // Select the whole category, remove any sub-level entries for it
        const withoutCat = value.filter((v) => v.categoryId !== catId)
        onChange([...withoutCat, { type: 'category', categoryId: catId }])
      }
    },
    [value, onChange, isCategoryFullyCovered]
  )

  const toggleSubcategory = useCallback(
    (cat, sub) => {
      const catId = cat._id
      const subId = sub._id

      if (isCategorySelected(catId)) {
        // Category was fully selected — split it into individual subs minus this one
        const activeSubs = (cat.subcategories || []).filter(
          (s) => s.isActive && s._id !== subId
        )
        const withoutCat = value.filter((v) => v.categoryId !== catId)
        const subEntries = activeSubs.map((s) => ({
          type: 'subcategory',
          categoryId: catId,
          subcategoryId: s._id,
        }))
        onChange([...withoutCat, ...subEntries])
        return
      }

      if (isSubcategorySelected(catId, subId)) {
        // Deselect this sub
        const next = value.filter(
          (v) => !(v.type === 'subcategory' && v.categoryId === catId && v.subcategoryId === subId)
        )
        onChange(next)
      } else {
        // Select this sub — check if all subs are now selected → upgrade to whole category
        const activeSubs = (cat.subcategories || []).filter((s) => s.isActive)
        const currentSubs = value.filter(
          (v) => v.type === 'subcategory' && v.categoryId === catId
        )
        const willBeAllSelected = currentSubs.length + 1 === activeSubs.length

        if (willBeAllSelected) {
          // Upgrade: replace all sub entries with a single category entry
          const withoutCat = value.filter((v) => v.categoryId !== catId)
          onChange([...withoutCat, { type: 'category', categoryId: catId }])
        } else {
          onChange([...value, { type: 'subcategory', categoryId: catId, subcategoryId: subId }])
        }
      }
    },
    [value, onChange, isCategorySelected, isSubcategorySelected]
  )

  const removeItem = useCallback(
    (item, e) => {
      e.stopPropagation()
      if (item.type === 'category') {
        onChange(value.filter((v) => v.categoryId !== item.categoryId))
      } else {
        onChange(
          value.filter(
            (v) =>
              !(
                v.type === 'subcategory' &&
                v.categoryId === item.categoryId &&
                v.subcategoryId === item.subcategoryId
              )
          )
        )
      }
    },
    [value, onChange]
  )

  // ── Build pill labels for selected items ──────────────────────────────────
  const buildPills = () => {
    const pills = []
    const catMap = Object.fromEntries(categories.map((c) => [c._id, c]))

    for (const item of value) {
      const cat = catMap[item.categoryId]
      if (!cat) continue

      if (item.type === 'category') {
        pills.push({ key: `cat_${item.categoryId}`, label: cat.name, item })
      } else {
        const sub = (cat.subcategories || []).find((s) => s._id === item.subcategoryId)
        if (sub) {
          pills.push({
            key: `sub_${item.categoryId}_${item.subcategoryId}`,
            label: `${cat.name} › ${sub.name}`,
            item,
            isSub: true,
          })
        }
      }
    }
    return pills
  }

  const pills = buildPills()

  // ── Filtered categories for dropdown ─────────────────────────────────────
  const filteredCats = categories.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    if (c.name.toLowerCase().includes(q)) return true
    return (c.subcategories || []).some((s) => s.name.toLowerCase().includes(q))
  })

  const toggleExpand = (catId, e) => {
    e.stopPropagation()
    setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }))
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5 relative">
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}

      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex flex-wrap items-center gap-1.5 min-h-[40px] w-full',
          'rounded-xl border bg-white px-3 py-1.5 cursor-pointer transition-colors',
          disabled
            ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200'
            : open
              ? 'border-primary-500 ring-2 ring-primary-500'
              : 'border-slate-200 hover:border-slate-300'
        )}
      >
        {pills.length === 0 ? (
          <span className="text-slate-400 text-sm py-0.5 flex-1">{placeholder}</span>
        ) : (
          pills.map((pill) => (
            <span
              key={pill.key}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border',
                pill.isSub
                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                  : 'bg-primary-50 text-primary-700 border-primary-200'
              )}
            >
              {pill.label}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeItem(pill.item, e)}
                  className="hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${pill.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))
        )}

        <span className="ml-auto flex-shrink-0 pl-1">
          {isLoading
            ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            : <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-180')} />
          }
        </span>
      </div>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">

          {/* Search */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories or subcategories..."
                className="flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setSearch('') }}
                  className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Tree list */}
          <ul role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-1">
            {filteredCats.length === 0 ? (
              <li className="px-4 py-3 text-xs text-slate-400 text-center">
                {search ? 'No matches found' : 'No active categories'}
              </li>
            ) : filteredCats.map((cat) => {
              const activeSubs = (cat.subcategories || []).filter((s) => s.isActive)
              const hasSubs = activeSubs.length > 0
              const isExpanded = expandedCats[cat._id] ?? false
              const fullyCovered = isCategoryFullyCovered(cat)
              const partial = isPartiallySelected(cat)

              // When searching, show matching subs even if category not expanded
              const filteredSubs = search
                ? activeSubs.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
                : activeSubs
              const showSubs = isExpanded || (search && filteredSubs.length > 0)

              return (
                <li key={cat._id}>
                  {/* ── Category row ── */}
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors select-none',
                      fullyCovered ? 'bg-primary-50' : partial ? 'bg-primary-50/40' : 'hover:bg-slate-50'
                    )}
                  >
                    {/* Expand/collapse chevron */}
                    <button
                      type="button"
                      onClick={(e) => hasSubs && toggleExpand(cat._id, e)}
                      className={cn(
                        'flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors',
                        hasSubs ? 'text-slate-400 hover:text-slate-600' : 'invisible'
                      )}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', showSubs && !search && 'rotate-90')} />
                    </button>

                    {/* Checkbox */}
                    <div
                      onClick={(e) => { e.stopPropagation(); toggleCategory(cat) }}
                      className={cn(
                        'w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors cursor-pointer',
                        fullyCovered
                          ? 'bg-primary-600 border-primary-600'
                          : partial
                            ? 'bg-primary-100 border-primary-400'
                            : 'border-slate-300 bg-white hover:border-primary-400'
                      )}
                    >
                      {fullyCovered && <Check className="w-3 h-3 text-white" />}
                      {partial && <div className="w-2 h-2 rounded-sm bg-primary-500" />}
                    </div>

                    {/* Category name */}
                    <div
                      className="flex items-center gap-2 flex-1 min-w-0"
                      onClick={(e) => { e.stopPropagation(); toggleCategory(cat) }}
                    >
                      {isExpanded || showSubs
                        ? <FolderOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        : <Folder className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      }
                      <span className={cn('text-sm font-medium truncate', fullyCovered ? 'text-primary-700' : 'text-slate-700')}>
                        {cat.name}
                      </span>
                      {hasSubs && (
                        <span className="ml-auto text-xs text-slate-400 flex-shrink-0">
                          {activeSubs.length} subs
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Subcategory rows ── */}
                  {showSubs && filteredSubs.map((sub) => {
                    const subSelected = isCategorySelected(cat._id) || isSubcategorySelected(cat._id, sub._id)
                    return (
                      <div
                        key={sub._id}
                        onClick={(e) => { e.stopPropagation(); toggleSubcategory(cat, sub) }}
                        className={cn(
                          'flex items-center gap-2 pl-10 pr-3 py-2 cursor-pointer transition-colors select-none',
                          subSelected ? 'bg-violet-50' : 'hover:bg-slate-50'
                        )}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                            subSelected
                              ? 'bg-violet-600 border-violet-600'
                              : 'border-slate-300 bg-white'
                          )}
                        >
                          {subSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={cn('text-sm truncate', subSelected ? 'text-violet-700 font-medium' : 'text-slate-600')}>
                          {sub.name}
                        </span>
                        {isCategorySelected(cat._id) && (
                          <span className="ml-auto text-xs text-slate-400 italic">via category</span>
                        )}
                      </div>
                    )
                  })}
                </li>
              )
            })}
          </ul>

          {/* Footer */}
          {value.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {value.length} selection{value.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange([]); setOpen(false) }}
                className="text-xs text-slate-500 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {helperText && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  )
}

export default CategoryMultiSelect
