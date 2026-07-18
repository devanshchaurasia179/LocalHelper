import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Plus,
  FileText,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  Hash,
  Layers,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { listDocumentTypes } from '@/api/documentType.api'
import useDocumentTypeMutations from '@/hooks/useDocumentTypeMutations'
import DocumentTypeForm from '@/components/documents/DocumentTypeForm'
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
 * DocumentManagementPage — full CRUD for DocumentTypes.
 *
 * Architecture decisions:
 * 1. The table is client-side for now (the API returns all types at once — no pagination).
 *    DocumentTypes is a small config collection (tens of items), not a large dataset.
 * 2. Mutations are centralised in useDocumentTypeMutations.
 * 3. The form (DocumentTypeForm) handles both create and edit to keep the schema DRY.
 * 4. Delete is hard-blocked if any uploads reference the type (backend enforces this).
 *    We show "Disable" as the primary action and Delete only for unused types.
 */

const DocumentManagementPage = () => {
  const [search,     setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'active' | 'inactive'

  // Modal state
  const [formOpen,      setFormOpen]      = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)  // null = create, obj = edit
  const [deleteTarget,  setDeleteTarget]  = useState(null)  // doc type to delete
  const [deleteOpen,    setDeleteOpen]    = useState(false)

  // ── Data ──────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['documentTypes'],
    queryFn: () => listDocumentTypes(),
  })

  const allTypes = data?.documentTypes || []

  // Client-side filter + search
  const filtered = allTypes.filter((dt) => {
    const matchesSearch =
      !search ||
      dt.label.toLowerCase().includes(search.toLowerCase()) ||
      dt.key.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active'   &&  dt.isActive) ||
      (filterStatus === 'inactive' && !dt.isActive)

    return matchesSearch && matchesStatus
  })

  // ── Mutations ──────────────────────────────────────────────────────
  const {
    createMutation,
    updateMutation,
    toggleMutation,
    deleteMutation,
    orderMutation,
    isAnyPending,
  } = useDocumentTypeMutations({
    onCreate: () => setFormOpen(false),
    onUpdate: () => { setFormOpen(false); setEditTarget(null) },
    onDelete: () => { setDeleteOpen(false); setDeleteTarget(null) },
  })

  // ── Handlers ──────────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const handleEdit = useCallback((dt) => {
    setEditTarget(dt)
    setFormOpen(true)
  }, [])

  const handleFormSubmit = useCallback((formData) => {
    if (editTarget) {
      // Edit: don't send the key field (backend rejects it)
      const { key, ...patchData } = formData
      updateMutation.mutate({ id: editTarget._id, data: patchData })
    } else {
      createMutation.mutate(formData)
    }
  }, [editTarget, createMutation, updateMutation])

  const handleToggle = useCallback((dt) => {
    toggleMutation.mutate(dt._id)
  }, [toggleMutation])

  const handleDeleteClick = useCallback((dt) => {
    setDeleteTarget(dt)
    setDeleteOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget._id)
    }
  }, [deleteTarget, deleteMutation])

  const handleOrderUp = useCallback((dt, index) => {
    if (index === 0) return
    const prev = filtered[index - 1]
    // Swap orders
    orderMutation.mutate({ id: dt._id,   displayOrder: prev.displayOrder })
    orderMutation.mutate({ id: prev._id, displayOrder: dt.displayOrder })
  }, [filtered, orderMutation])

  const handleOrderDown = useCallback((dt, index) => {
    if (index === filtered.length - 1) return
    const next = filtered[index + 1]
    orderMutation.mutate({ id: dt._id,   displayOrder: next.displayOrder })
    orderMutation.mutate({ id: next._id, displayOrder: dt.displayOrder })
  }, [filtered, orderMutation])

  // ── Stats summary ─────────────────────────────────────────────────
  const stats = {
    total:    allTypes.length,
    active:   allTypes.filter((d) => d.isActive).length,
    required: allTypes.filter((d) => d.isRequired && d.isActive).length,
    inactive: allTypes.filter((d) => !d.isActive).length,
  }

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="Document Management"
        subtitle="Configure the documents partners must upload for verification. Changes take effect immediately."
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleCreate}
          >
            New Document Type
          </Button>
        }
      />

      {/* ── Stat pills ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Total',    value: stats.total,    color: 'bg-slate-100 text-slate-700' },
          { label: 'Active',   value: stats.active,   color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Required', value: stats.required, color: 'bg-blue-50 text-blue-700' },
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
            placeholder="Search by name or key..."
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
          <table className="w-full text-sm" role="table" aria-label="Document types table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Order</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Document</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Key</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Config</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Required</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton.TableRow key={i} cols={7} />
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7}>
                    <ErrorState message="Could not load document types." onRetry={refetch} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={FileText}
                      title={search ? 'No results' : 'No document types yet'}
                      description={
                        search
                          ? 'No document types match your search.'
                          : 'Create your first document type to get started.'
                      }
                      action={
                        !search && (
                          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={handleCreate}>
                            Create Document Type
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((dt, index) => (
                  <DocumentTypeRow
                    key={dt._id}
                    dt={dt}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === filtered.length - 1}
                    onEdit={() => handleEdit(dt)}
                    onToggle={() => handleToggle(dt)}
                    onDelete={() => handleDeleteClick(dt)}
                    onOrderUp={() => handleOrderUp(dt, index)}
                    onOrderDown={() => handleOrderDown(dt, index)}
                    isToggling={toggleMutation.isPending && toggleMutation.variables === dt._id}
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
              Showing {filtered.length} of {allTypes.length} document types
              {search && ` matching "${search}"`}
            </p>
          </div>
        )}
      </Card>

      {/* ── Create / Edit Form ─────────────────────────────────────── */}
      <DocumentTypeForm
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
        title="Delete Document Type"
        message={
          deleteTarget
            ? `Permanently delete "${deleteTarget.label}"? This cannot be undone. The backend will block this if any partner uploads reference this type — use Disable instead.`
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

const DocumentTypeRow = ({
  dt,
  index,
  isFirst,
  isLast,
  onEdit,
  onToggle,
  onDelete,
  onOrderUp,
  onOrderDown,
  isToggling,
  disabled,
}) => {
  return (
    <motion.tr
      layout
      className={cn('border-b border-slate-50 transition-colors', dt.isActive ? 'hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/50 opacity-70')}
      initial={{ opacity: 0 }}
      animate={{ opacity: dt.isActive ? 1 : 0.7 }}
    >
      {/* Order */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-slate-400 w-6 tabular-nums">{dt.displayOrder}</span>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={onOrderUp}
              disabled={isFirst || disabled}
              className="p-0.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Move up"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              onClick={onOrderDown}
              disabled={isLast || disabled}
              className="p-0.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Move down"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </td>

      {/* Document name + description */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 truncate max-w-[180px]">{dt.label}</p>
            {dt.description && (
              <p className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">{dt.description}</p>
            )}
          </div>
        </div>
      </td>

      {/* Key */}
      <td className="px-4 py-3.5">
        <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-mono">
          {dt.key}
        </code>
      </td>

      {/* Config flags */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {dt.isMultiPage && (
            <ConfigPill icon={Layers} label="Multi-page" />
          )}
          {dt.hasNumberField && (
            <ConfigPill icon={Hash} label="Has number" />
          )}
          <ConfigPill
            icon={null}
            label={`${dt.maxFileSizeMB ?? 5} MB max`}
          />
        </div>
      </td>

      {/* Required */}
      <td className="px-4 py-3.5">
        {dt.isRequired ? (
          <StatusBadge label="Required" variant="info" />
        ) : (
          <StatusBadge label="Optional" variant="default" />
        )}
      </td>

      {/* Active status */}
      <td className="px-4 py-3.5">
        <StatusBadge
          label={dt.isActive ? 'Active' : 'Disabled'}
          variant={dt.isActive ? 'success' : 'default'}
        />
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1">
          {/* Edit */}
          <button
            onClick={onEdit}
            disabled={disabled}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Edit"
            aria-label={`Edit ${dt.label}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* Toggle active */}
          <button
            onClick={onToggle}
            disabled={disabled || isToggling}
            className={cn(
              'p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
              dt.isActive
                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
            )}
            title={dt.isActive ? 'Disable' : 'Enable'}
            aria-label={dt.isActive ? `Disable ${dt.label}` : `Enable ${dt.label}`}
          >
            {dt.isActive
              ? <ToggleRight className="w-3.5 h-3.5" />
              : <ToggleLeft  className="w-3.5 h-3.5" />
            }
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            disabled={disabled}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Delete (only if no uploads reference this type)"
            aria-label={`Delete ${dt.label}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </motion.tr>
  )
}

const ConfigPill = ({ icon: Icon, label }) => (
  <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
    {Icon && <Icon className="w-3 h-3" />}
    {label}
  </span>
)

export default DocumentManagementPage
