import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Hash,
  RefreshCw,
  Calendar,
  HardDrive,
  User,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDateTime, formatDate } from '@/utils/formatters'

/**
 * DocumentCard — renders a single partner document for admin review.
 *
 * Everything is driven by the `document` prop from the backend response.
 * Zero hardcoding of document types — no "if (key === 'aadhaar')" logic.
 *
 * Props:
 *   document        — document object from GET /api/admin/verification/:partnerId
 *   onPreview(doc)  — open fullscreen preview
 *   onApprove(doc)  — trigger approve flow
 *   onReject(doc)   — trigger reject flow
 *   disabled        — true while any mutation is in-flight
 */

const STATUS_CONFIG = {
  Approved: {
    variant: 'success',
    icon: CheckCircle2,
    label: 'Approved',
    headerBg: 'bg-emerald-50 border-emerald-100',
    iconColor: 'text-emerald-600',
  },
  Rejected: {
    variant: 'danger',
    icon: XCircle,
    label: 'Rejected',
    headerBg: 'bg-red-50 border-red-100',
    iconColor: 'text-red-500',
  },
  'Under Review': {
    variant: 'info',
    icon: Clock,
    label: 'Under Review',
    headerBg: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-500',
  },
  Pending: {
    variant: 'warning',
    icon: AlertCircle,
    label: 'Pending',
    headerBg: 'bg-amber-50 border-amber-100',
    iconColor: 'text-amber-500',
  },
}

const DEFAULT_STATUS = {
  variant: 'default',
  icon: FileText,
  label: 'Unknown',
  headerBg: 'bg-slate-50 border-slate-100',
  iconColor: 'text-slate-400',
}

const formatFileSize = (bytes) => {
  if (!bytes) return null
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DocumentCard = ({ document, onPreview, onApprove, onReject, disabled = false }) => {
  const statusCfg = STATUS_CONFIG[document.status] || DEFAULT_STATUS
  const StatusIcon = statusCfg.icon

  const canApprove = document.status !== 'Approved' && document.status !== 'Pending'
  const canReject  = document.status !== 'Rejected' && document.status !== 'Pending'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden"
    >
      {/* ── Header band ──────────────────────────────────────────────── */}
      <div className={cn('px-5 py-3.5 border-b flex items-center justify-between gap-3', statusCfg.headerBg)}>
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Icon from backend or fallback */}
          <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
            <StatusIcon className={cn('w-4 h-4', statusCfg.iconColor)} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {document.title}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {document.isRequired ? 'Required' : 'Optional'}
              {document.reuploadCount > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  · Re-uploaded {document.reuploadCount}×
                </span>
              )}
            </p>
          </div>
        </div>
        <StatusBadge label={statusCfg.label} variant={statusCfg.variant} />
      </div>

      {/* ── Preview thumbnail ─────────────────────────────────────────── */}
      <div
        className="relative group cursor-pointer bg-slate-50 overflow-hidden"
        style={{ height: 180 }}
        onClick={() => onPreview(document)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onPreview(document)}
        aria-label={`Preview ${document.title}`}
      >
        {document.previewUrl ? (
          <>
            {document.fileFormat?.toLowerCase() === 'pdf' ||
            document.previewUrl.toLowerCase().endsWith('.pdf') ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                <FileText className="w-10 h-10" />
                <p className="text-xs font-medium">PDF Document</p>
              </div>
            ) : (
              <img
                src={document.previewUrl}
                alt={document.title}
                className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              />
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-white/95 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg">
                  <Eye className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-semibold text-slate-700">Preview</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
            <FileText className="w-10 h-10" />
            <p className="text-xs">No preview available</p>
          </div>
        )}
      </div>

      {/* ── Metadata ──────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-2.5">
        {/* Number value (e.g., Aadhaar number, PAN number) */}
        {document.numberValue && (
          <MetaRow icon={Hash} label="Number" value={document.numberValue} />
        )}

        {/* Upload time */}
        {document.uploadedAt && (
          <MetaRow
            icon={Calendar}
            label="Uploaded"
            value={formatDateTime(document.uploadedAt)}
          />
        )}

        {/* File size */}
        {document.fileBytes && (
          <MetaRow
            icon={HardDrive}
            label="File size"
            value={formatFileSize(document.fileBytes)}
          />
        )}

        {/* Version */}
        {document.version > 1 && (
          <MetaRow
            icon={RefreshCw}
            label="Version"
            value={`v${document.version}`}
          />
        )}

        {/* Approved by / rejected by */}
        {document.status === 'Approved' && document.approvedBy && (
          <MetaRow
            icon={User}
            label="Approved by"
            value={`${document.approvedBy} · ${formatDate(document.approvedAt)}`}
            className="text-emerald-700"
          />
        )}
        {document.status === 'Rejected' && document.rejectedBy && (
          <MetaRow
            icon={User}
            label="Rejected by"
            value={`${document.rejectedBy} · ${formatDate(document.rejectedAt)}`}
            className="text-red-600"
          />
        )}

        {/* Rejection reason */}
        {document.rejectionReason && (
          <div className="mt-1 p-2.5 bg-red-50 rounded-xl border border-red-100">
            <p className="text-xs font-semibold text-red-600 mb-0.5">Rejection Reason</p>
            <p className="text-xs text-red-700 leading-relaxed">{document.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="px-5 pb-5 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Eye className="w-3.5 h-3.5" />}
          onClick={() => onPreview(document)}
          className="flex-1"
        >
          Preview
        </Button>
        {canApprove && (
          <Button
            variant="success"
            size="sm"
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => onApprove(document)}
            disabled={disabled}
            className="flex-1"
          >
            Approve
          </Button>
        )}
        {/* Show Reject when status is Under Review (canReject true) OR Approved (allow revoking) */}
        {(canReject || document.status === 'Approved') && (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<XCircle className="w-3.5 h-3.5" />}
            onClick={() => onReject(document)}
            disabled={disabled}
            className="flex-1"
          >
            Reject
          </Button>
        )}
      </div>
    </motion.div>
  )
}

const MetaRow = ({ icon: Icon, label, value, className }) => (
  <div className="flex items-center gap-2 min-w-0">
    <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
    <span className="text-xs text-slate-400 flex-shrink-0">{label}:</span>
    <span className={cn('text-xs font-medium text-slate-700 truncate', className)}>
      {value}
    </span>
  </div>
)

export default DocumentCard
