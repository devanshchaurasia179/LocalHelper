import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Plus,
  Wrench,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
} from 'lucide-react'
import { listCategories } from '@/api/category.api'
import useCategoryMutations from '@/hooks/useCategoryMutations'
import CategoryForm from '@/components/categories/CategoryForm'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import ConfirmModal from '@/components/ui/ConfirmModal'
import PageHeader from '@/components/ui/PageHeader'
import SearchBar from '@/components/ui/SearchBar'
import { cn } from '@/utils/cn'

/**
 * ServicesPage — full CRUD for service Categories.
 *
 * Similar architecture to DocumentManagementPage:
 * - Client-side search/filter (categories is a small collection)
 * - Mutations centralised in useCategoryMutations
 * - CategoryForm handles both create and edit
 * - Delete is blocked if partners reference the category
 */
const ServicesPage = () => {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // Modal state
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // ── Data ──────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategories(),
  })

  const allCategories = data?.categories || []

  // Client-side filter + search
  const filtered = allCategories.filter((cat) => {
    const matchesSearch =
      !search ||
      cat.name.toLowerCase().includes(search.toLowerCase()) ||
      (cat.description || '').toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && cat.isActive) ||
      (filterStatus === 'inactive' && !cat.isActive)

    return matchesSearch && matchesStatus
  })

  // ── Mutations ──────────────────────────────────────────────────────
  const {
    createMutation,
    updateMutation,
    toggleMutation,
    deleteMutation,
    isAnyPending,
  } = useCategoryMutations({
    onCreate: () => setFormOpen(false),
    onUpdate: () => { setFormOpen(false); setEditTarget(null) },
    onDelete: () => { setDeleteOpen(false); setDeleteTarget(null) },
  })

  // ── Handlers ──────────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const handleEdit = useCallback((cat) => {
    setEditTarget(cat)
    setFormOpen(true)
  }, [])

  const handleFormSubmit = useCallback((formData) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget._id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }, [editTarget, createMutation, updateMutation])

  const handleToggle = useCallback((cat) => {
    toggleMutation.mutate(cat._id)
  }, [toggleMutation])

  const handleDeleteClick = useCallback((cat) => {
    setDeleteTarget(cat)
    setDeleteOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget._id)
    }
  }, [deleteTarget, deleteMutation])

  // ── Stats ──────────────────────────────────────────────────────────
  const stats = {
    total: allCategories.length,
    active: allCategories.filter((c) => c.isActive).length,
    inactive: allCategories.filter((c) => !c.isActive).length,
  }

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="Service Categories"
        subtitle="Manage the service categories available to partners. Changes reflect across all apps immediately."
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleCreate}
          >
            New Category
          </Button>
        }
      />

      {/* ── Stat pills ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'bg-slate-100 text-slate-700' },
          { label: 'Active', value: stats.active, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Disabled', value: stats.inactive, color: 'bg-slate-100 text-slate-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium', color)}>
            <span className="font-bold tabular-nums">{value}</span>
            <span className="text-xs opacity-70">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Main table card ─────────────────────────────────────────── */}
      <Card>
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <SearchBar
            value={search}
            onChange={(v) => setSearch(v)}
            placeholder="Search categories..."
            className="w-full sm:w-64"
          />
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {['all', 'active', 'inactive'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
                  filterStatus === s
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Categories table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Icon</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton.TableRow key={i} cols={5} />
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={5}>
                    <ErrorState message="Could not load categories." onRetry={refetch} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={Wrench}
                      title={search ? 'No results' : 'No categories yet'}
                      description={
                        search
                          ? 'No categories match your search.'
                          : 'Create your first service category to get started.'
                      }
                      action={
                        !search && (
                          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={handleCreate}>
                            Create Category
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((cat) => (
                  <CategoryRow
                    key={cat._id}
                    cat={cat}
                    onEdit={() => handleEdit(cat)}
                    onToggle={() => handleToggle(cat)}
                    onDelete={() => handleDeleteClick(cat)}
                    isToggling={toggleMutation.isPending && toggleMutation.variables === cat._id}
                    disabled={isAnyPending}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-50">
            <p className="text-xs text-slate-400">
              Showing {filtered.length} of {allCategories.length} categories
              {search && ` matching "${search}"`}
            </p>
          </div>
        )}
      </Card>

      {/* ── Create / Edit Form ─────────────────────────────────────── */}
      <CategoryForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null) }}
        onSubmit={handleFormSubmit}
        defaultValues={editTarget}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* ── Delete confirm ─────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message={
          deleteTarget
            ? `Permanently delete "${deleteTarget.name}"? This cannot be undone. If partners are using this category, the delete will be blocked — use Disable instead.`
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// ── Row component ─────────────────────────────────────────────────────

const CategoryRow = ({ cat, onEdit, onToggle, onDelete, isToggling, disabled }) => {
  return (
    <motion.tr
      layout
      className={cn(
        'border-b border-slate-50 transition-colors',
        cat.isActive ? 'hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/50 opacity-70'
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: cat.isActive ? 1 : 0.7 }}
    >
      {/* Category name */}
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-slate-400" />
          </div>
          <p className="font-medium text-slate-800">{cat.name}</p>
        </div>
      </td>

      {/* Description */}
      <td className="px-6 py-3.5">
        <p className="text-slate-500 truncate max-w-[250px]">
          {cat.description || <span className="text-slate-300 italic">No description</span>}
        </p>
      </td>

      {/* Icon */}
      <td className="px-6 py-3.5">
        {cat.icon ? (
          <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-mono">
            {cat.icon}
          </code>
        ) : (
          <span className="text-xs text-slate-300 italic">None</span>
        )}
      </td>

      {/* Status */}
      <td className="px-6 py-3.5">
        <StatusBadge
          label={cat.isActive ? 'Active' : 'Disabled'}
          variant={cat.isActive ? 'success' : 'default'}
        />
      </td>

      {/* Actions */}
      <td className="px-6 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            disabled={disabled}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Edit"
            aria-label={`Edit ${cat.name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggle}
            disabled={disabled || isToggling}
            className={cn(
              'p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
              cat.isActive
                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
            )}
            title={cat.isActive ? 'Disable' : 'Enable'}
            aria-label={cat.isActive ? `Disable ${cat.name}` : `Enable ${cat.name}`}
          >
            {cat.isActive
              ? <ToggleRight className="w-3.5 h-3.5" />
              : <ToggleLeft className="w-3.5 h-3.5" />
            }
          </button>

          <button
            onClick={onDelete}
            disabled={disabled}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Delete (only if no partners use this category)"
            aria-label={`Delete ${cat.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </motion.tr>
  )
}

export default ServicesPage
