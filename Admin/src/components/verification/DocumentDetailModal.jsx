import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Download,
  FileText,
  AlertCircle,
  Hash,
  Calendar,
  HardDrive,
  RefreshCw,
  User,
  CheckCircle2,
  XCircle,
  Images,
  Shield,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDateTime, formatDate } from '@/utils/formatters'

/**
 * DocumentDetailModal — split-pane modal for document review.
 *
 * Left  — image viewer with zoom / rotate / multi-photo navigation
 * Right — document metadata, status, and approve / reject actions
 *
 * Props:
 *   isOpen          — boolean
 *   onClose         — () => void
 *   document        — full document object from the backend
 *   onApprove(doc)  — called when Approve is clicked
 *   onReject(doc)   — called when Reject is clicked
 *   disabled        — true while a mutation is in-flight
 */

const MIN_ZOOM  = 0.5
const MAX_ZOOM  = 4
const ZOOM_STEP = 0.25

const STATUS_CONFIG = {
  Approved:       { variant: 'success', label: 'Approved'     },
  Rejected:       { variant: 'danger',  label: 'Rejected'     },
  'Under Review': { variant: 'info',    label: 'Under Review' },
  Pending:        { variant: 'warning', label: 'Pending'      },
}

const isImageUrl = (format, url) => {
  if (!url) return false
  if (format) {
    const f = format.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(f)) return true
    if (f === 'pdf') return false
  }
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(ext ?? '')
}

const isPdfUrl = (format, url) => {
  if (format?.toLowerCase() === 'pdf') return true
  return url?.split('?')[0].split('.').pop()?.toLowerCase() === 'pdf'
}

const formatFileSize = (bytes) => {
  if (!bytes) return null
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─────────────────────────────────────────────────────────────────────────────

const DocumentDetailModal = ({
  isOpen,
  onClose,
  document: doc,
  onApprove,
  onReject,
  disabled = false,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0)
  const [zoom,       setZoom]       = useState(1)
  const [rotation,   setRotation]   = useState(0)
  const [imgError,   setImgError]   = useState(false)

  // Collect all photo URLs
  const allUrls = doc?.previewUrls?.length
    ? doc.previewUrls
    : doc?.previewUrl
      ? [doc.previewUrl]
      : []

  const photoCount = allUrls.length
  const activeUrl  = allUrls[photoIndex] || null
  const isImg      = isImageUrl(doc?.fileFormat, activeUrl)
  const isPdf      = isPdfUrl(doc?.fileFormat, activeUrl)

  const statusCfg  = STATUS_CONFIG[doc?.status] || { variant: 'default', label: doc?.status || '—' }
  const canApprove = doc?.status !== 'Approved' && doc?.status !== 'Pending'
  const canReject  = doc?.status !== 'Rejected' && doc?.status !== 'Pending'

  // Reset viewer state when photo or modal changes
  useEffect(() => {
    setZoom(1)
    setRotation(0)
    setImgError(false)
  }, [photoIndex, isOpen])

  // Reset photo index when document changes
  useEffect(() => {
    setPhotoIndex(0)
  }, [doc?.documentId, isOpen])

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Keyboard shortcuts
  const handleKey = useCallback((e) => {
    if (!isOpen) return
    if (e.key === 'Escape')     { onClose(); return }
    if (e.key === 'ArrowLeft')  setPhotoIndex((i) => Math.max(0, i - 1))
    if (e.key === 'ArrowRight') setPhotoIndex((i) => Math.min(photoCount - 1, i + 1))
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
    if (e.key === '-') setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
  }, [isOpen, photoCount, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const handleDownload = () => {
    if (!activeUrl) return
    const a = document.createElement('a')
    a.href     = activeUrl
    a.download = doc?.title || 'document'
    a.target   = '_blank'
    a.rel      = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!doc) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          role="dialog"
          aria-modal="true"
          aria-label={`Document detail: ${doc.title}`}
        >
          <motion.div
            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{doc.title}</p>
                  <p className="text-xs text-slate-400">
                    {doc.isRequired ? 'Required' : 'Optional'}
                    {doc.reuploadCount > 0 && (
                      <span className="ml-1.5 text-amber-600 font-medium">
                        · Re-uploaded {doc.reuploadCount}×
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge label={statusCfg.label} variant={statusCfg.variant} size="md" />
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-1"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Body: image left, details right ──────────────────────── */}
            <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

              {/* ── Left: image viewer ──────────────────────────────────── */}
              <div className="sm:w-[55%] flex flex-col bg-slate-950 flex-shrink-0">

                {/* Viewer area */}
                <div className="relative flex-1 flex items-center justify-center overflow-hidden min-h-[240px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={photoIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="w-full h-full flex items-center justify-center p-3"
                    >
                      {!activeUrl ? (
                        <NoPreview message="No preview available" />
                      ) : isImg ? (
                        imgError ? (
                          <NoPreview message="Failed to load image" />
                        ) : (
                          <img
                            src={activeUrl}
                            alt={doc.title}
                            className="object-contain select-none transition-transform duration-200"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              transform: `scale(${zoom}) rotate(${rotation}deg)`,
                              transformOrigin: 'center center',
                            }}
                            onError={() => setImgError(true)}
                            draggable={false}
                          />
                        )
                      ) : isPdf ? (
                        <iframe
                          src={activeUrl}
                          title={doc.title}
                          className="w-full border-0 rounded"
                          style={{ height: '100%', minHeight: 240 }}
                        />
                      ) : (
                        <NoPreview message="Preview not supported for this file type" />
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Prev / next arrows */}
                  {photoCount > 1 && photoIndex > 0 && (
                    <PhotoNavBtn
                      direction="left"
                      onClick={() => setPhotoIndex((i) => i - 1)}
                    />
                  )}
                  {photoCount > 1 && photoIndex < photoCount - 1 && (
                    <PhotoNavBtn
                      direction="right"
                      onClick={() => setPhotoIndex((i) => i + 1)}
                    />
                  )}

                  {/* Photo count badge */}
                  {photoCount > 1 && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-slate-900/70 text-white text-xs font-semibold px-2 py-1 rounded-lg backdrop-blur-sm pointer-events-none">
                      <Images className="w-3 h-3" />
                      <span>{photoIndex + 1} / {photoCount}</span>
                    </div>
                  )}
                </div>

                {/* Image toolbar */}
                {activeUrl && (
                  <div className="flex-shrink-0 h-10 bg-slate-900/80 flex items-center justify-center gap-1 px-3 border-t border-white/10">
                    {isImg && (
                      <>
                        <ViewerBtn onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))} title="Zoom out" disabled={zoom <= MIN_ZOOM}>
                          <ZoomOut className="w-3.5 h-3.5" />
                        </ViewerBtn>
                        <span className="text-[10px] text-slate-400 tabular-nums w-8 text-center select-none">
                          {Math.round(zoom * 100)}%
                        </span>
                        <ViewerBtn onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))} title="Zoom in" disabled={zoom >= MAX_ZOOM}>
                          <ZoomIn className="w-3.5 h-3.5" />
                        </ViewerBtn>
                        <ViewerBtn onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate 90°">
                          <RotateCw className="w-3.5 h-3.5" />
                        </ViewerBtn>
                        {(zoom !== 1 || rotation !== 0) && (
                          <ViewerBtn onClick={() => { setZoom(1); setRotation(0) }} title="Reset">
                            <Maximize2 className="w-3.5 h-3.5" />
                          </ViewerBtn>
                        )}
                        <div className="w-px h-4 bg-white/10 mx-1" />
                      </>
                    )}
                    <ViewerBtn onClick={handleDownload} title="Download">
                      <Download className="w-3.5 h-3.5" />
                    </ViewerBtn>
                  </div>
                )}

                {/* Thumbnail strip for multi-photo docs */}
                {photoCount > 1 && (
                  <div className="flex-shrink-0 h-14 bg-slate-900 flex items-center justify-center gap-1.5 px-3 overflow-x-auto border-t border-white/10">
                    {allUrls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIndex(i)}
                        className={cn(
                          'flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden border-2 transition-all',
                          i === photoIndex
                            ? 'border-primary-400 scale-110 ring-2 ring-primary-400/30'
                            : 'border-transparent opacity-50 hover:opacity-100'
                        )}
                        title={`Photo ${i + 1}`}
                        aria-label={`View photo ${i + 1}`}
                        aria-pressed={i === photoIndex}
                      >
                        {isImageUrl(doc.fileFormat, url) ? (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                            <FileText className="w-3 h-3 text-slate-400" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Right: details + actions ─────────────────────────────── */}
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">

                {/* Metadata */}
                <div className="px-5 py-5 space-y-3.5 flex-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Document Details
                  </p>

                  {/* Document number */}
                  {doc.numberValue && (
                    <DetailRow
                      icon={Hash}
                      label={doc.numberFieldLabel || `${doc.title} Number`}
                      value={doc.numberValue}
                      valueClass="font-mono font-semibold text-slate-800 tracking-wide"
                    />
                  )}

                  {/* Upload date */}
                  {doc.uploadedAt && (
                    <DetailRow
                      icon={Calendar}
                      label="Uploaded"
                      value={formatDateTime(doc.uploadedAt)}
                    />
                  )}

                  {/* File size */}
                  {doc.fileBytes && (
                    <DetailRow
                      icon={HardDrive}
                      label="File size"
                      value={formatFileSize(doc.fileBytes)}
                    />
                  )}

                  {/* Version */}
                  {doc.version > 1 && (
                    <DetailRow
                      icon={RefreshCw}
                      label="Version"
                      value={`v${doc.version}`}
                    />
                  )}

                  {/* Approved by */}
                  {doc.status === 'Approved' && doc.approvedBy && (
                    <DetailRow
                      icon={User}
                      label="Approved by"
                      value={`${doc.approvedBy} · ${formatDate(doc.approvedAt)}`}
                      valueClass="text-emerald-700 font-medium"
                    />
                  )}

                  {/* Rejected by */}
                  {doc.status === 'Rejected' && doc.rejectedBy && (
                    <DetailRow
                      icon={User}
                      label="Rejected by"
                      value={`${doc.rejectedBy} · ${formatDate(doc.rejectedAt)}`}
                      valueClass="text-red-600 font-medium"
                    />
                  )}

                  {/* Rejection reason */}
                  {doc.rejectionReason && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100 mt-1">
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">
                        Rejection Reason
                      </p>
                      <p className="text-xs text-red-700 leading-relaxed">
                        {doc.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex flex-col gap-2 flex-shrink-0">
                  {canApprove && (
                    <Button
                      variant="success"
                      fullWidth
                      size="md"
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() => { onApprove(doc); onClose() }}
                      disabled={disabled}
                    >
                      Approve Document
                    </Button>
                  )}
                  {(canReject || doc.status === 'Approved') && (
                    <Button
                      variant="danger"
                      fullWidth
                      size="md"
                      leftIcon={<XCircle className="w-4 h-4" />}
                      onClick={() => { onReject(doc); onClose() }}
                      disabled={disabled}
                    >
                      Reject Document
                    </Button>
                  )}
                  {!canApprove && !canReject && doc.status !== 'Approved' && (
                    <p className="text-xs text-slate-400 text-center py-1">
                      No actions available for this document.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ── Small helpers ────────────────────────────────────────────────────

const DetailRow = ({ icon: Icon, label, value, valueClass }) => (
  <div className="flex items-start gap-2.5">
    <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">
        {label}
      </p>
      <p className={cn('text-sm text-slate-700 break-words', valueClass)}>
        {value}
      </p>
    </div>
  </div>
)

const ViewerBtn = ({ children, className, ...props }) => (
  <button
    className={cn(
      'w-7 h-7 rounded-lg flex items-center justify-center',
      'text-slate-400 hover:text-white hover:bg-white/10',
      'transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
      className
    )}
    {...props}
  >
    {children}
  </button>
)

const PhotoNavBtn = ({ direction, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'absolute top-1/2 -translate-y-1/2 z-10',
      'w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700',
      'flex items-center justify-center text-white',
      'border border-white/10 backdrop-blur transition-all',
      'hover:scale-110 active:scale-95',
      direction === 'left' ? 'left-2' : 'right-2'
    )}
    aria-label={direction === 'left' ? 'Previous photo' : 'Next photo'}
  >
    {direction === 'left'
      ? <ChevronLeft className="w-4 h-4" />
      : <ChevronRight className="w-4 h-4" />
    }
  </button>
)

const NoPreview = ({ message }) => (
  <div className="flex flex-col items-center gap-3 text-slate-500">
    <AlertCircle className="w-10 h-10" />
    <p className="text-xs">{message}</p>
  </div>
)

export default DocumentDetailModal
