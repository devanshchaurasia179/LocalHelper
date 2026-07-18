import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Maximize2,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * DocumentPreviewModal — fullscreen document preview.
 *
 * Supports:
 *   - Images (jpeg, png, webp, gif, etc.) — zoomable, rotatable
 *   - PDFs — rendered in an iframe
 *   - Multi-document navigation via documents[] + currentIndex
 *
 * Props:
 *   isOpen         — boolean
 *   onClose        — () => void
 *   documents      — array of { previewUrl, title, fileFormat } or a single item
 *   currentIndex   — which document to show initially (default 0)
 *   onIndexChange  — (newIndex) => void   (optional, for multi-doc nav)
 */
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

const isImage = (format, url) => {
  if (!url) return false
  if (format) {
    const f = format.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(f)) return true
    if (f === 'pdf') return false
  }
  // Fallback: guess from URL extension
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(ext)
}

const isPDF = (format, url) => {
  if (format?.toLowerCase() === 'pdf') return true
  const ext = url?.split('?')[0].split('.').pop()?.toLowerCase()
  return ext === 'pdf'
}

const DocumentPreviewModal = ({
  isOpen,
  onClose,
  documents = [],
  currentIndex = 0,
  onIndexChange,
}) => {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [imgError, setImgError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(currentIndex)

  // Sync controlled currentIndex
  useEffect(() => {
    setActiveIndex(currentIndex)
  }, [currentIndex])

  // Reset state when doc changes or modal opens
  useEffect(() => {
    setZoom(1)
    setRotation(0)
    setImgError(false)
  }, [activeIndex, isOpen])

  // Keyboard navigation
  const handleKey = useCallback(
    (e) => {
      if (!isOpen) return
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          navigatePrev()
          break
        case 'ArrowRight':
          navigateNext()
          break
        case '+':
        case '=':
          handleZoomIn()
          break
        case '-':
          handleZoomOut()
          break
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, activeIndex, documents.length]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const currentDoc = documents[activeIndex]

  const navigatePrev = () => {
    if (activeIndex > 0) {
      const next = activeIndex - 1
      setActiveIndex(next)
      onIndexChange?.(next)
    }
  }

  const navigateNext = () => {
    if (activeIndex < documents.length - 1) {
      const next = activeIndex + 1
      setActiveIndex(next)
      onIndexChange?.(next)
    }
  }

  const handleZoomIn  = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
  const handleRotate  = () => setRotation((r) => (r + 90) % 360)
  const handleReset   = () => { setZoom(1); setRotation(0) }

  const handleDownload = () => {
    if (!currentDoc?.previewUrl) return
    const link = document.createElement('a')
    link.href = currentDoc.previewUrl
    link.download = currentDoc.title || 'document'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isImg = currentDoc ? isImage(currentDoc.fileFormat, currentDoc.previewUrl) : false
  const isPdf = currentDoc ? isPDF(currentDoc.fileFormat, currentDoc.previewUrl) : false

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Document preview: ${currentDoc?.title || 'Document'}`}
        >
          {/* ── Top toolbar ─────────────────────────────────────────────── */}
          <div className="flex-shrink-0 h-14 flex items-center justify-between px-4 bg-slate-900/80 backdrop-blur border-b border-white/10">
            {/* Left: title + meta */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-slate-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {currentDoc?.title || 'Document'}
                </p>
                {documents.length > 1 && (
                  <p className="text-xs text-slate-400">
                    {activeIndex + 1} of {documents.length}
                  </p>
                )}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Zoom controls — only for images */}
              {isImg && (
                <>
                  <ToolbarBtn onClick={handleZoomOut} title="Zoom out" disabled={zoom <= MIN_ZOOM}>
                    <ZoomOut className="w-4 h-4" />
                  </ToolbarBtn>
                  <span className="text-xs text-slate-400 tabular-nums w-10 text-center select-none">
                    {Math.round(zoom * 100)}%
                  </span>
                  <ToolbarBtn onClick={handleZoomIn} title="Zoom in" disabled={zoom >= MAX_ZOOM}>
                    <ZoomIn className="w-4 h-4" />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={handleRotate} title="Rotate 90°">
                    <RotateCw className="w-4 h-4" />
                  </ToolbarBtn>
                  {(zoom !== 1 || rotation !== 0) && (
                    <ToolbarBtn onClick={handleReset} title="Reset view">
                      <Maximize2 className="w-4 h-4" />
                    </ToolbarBtn>
                  )}
                  <div className="w-px h-5 bg-white/10 mx-1" />
                </>
              )}

              <ToolbarBtn onClick={handleDownload} title="Download">
                <Download className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn onClick={onClose} title="Close (Esc)" className="hover:bg-red-500/20 hover:text-red-300">
                <X className="w-4 h-4" />
              </ToolbarBtn>
            </div>
          </div>

          {/* ── Main content area ────────────────────────────────────────── */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            {/* Prev button */}
            {documents.length > 1 && activeIndex > 0 && (
              <NavBtn direction="left" onClick={navigatePrev} title="Previous (←)" />
            )}

            {/* Document display */}
            <div className="w-full h-full flex items-center justify-center overflow-hidden p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  {!currentDoc?.previewUrl ? (
                    <NoPreview message="No preview URL available" />
                  ) : isImg ? (
                    imgError ? (
                      <NoPreview message="Failed to load image" />
                    ) : (
                      <div
                        className="overflow-auto max-w-full max-h-full flex items-center justify-center"
                        style={{ width: '100%', height: '100%' }}
                      >
                        <img
                          src={currentDoc.previewUrl}
                          alt={currentDoc.title || 'Document preview'}
                          className="object-contain transition-transform duration-200 select-none"
                          style={{
                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                            transformOrigin: 'center center',
                            maxWidth: zoom === 1 ? '100%' : 'none',
                            maxHeight: zoom === 1 ? '100%' : 'none',
                          }}
                          onError={() => setImgError(true)}
                          draggable={false}
                        />
                      </div>
                    )
                  ) : isPdf ? (
                    <iframe
                      src={currentDoc.previewUrl}
                      title={currentDoc.title || 'PDF preview'}
                      className="w-full h-full rounded-lg border-0"
                      style={{ maxWidth: '900px', maxHeight: '100%' }}
                    />
                  ) : (
                    <NoPreview message="Preview not available for this file type" />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Next button */}
            {documents.length > 1 && activeIndex < documents.length - 1 && (
              <NavBtn direction="right" onClick={navigateNext} title="Next (→)" />
            )}
          </div>

          {/* ── Bottom thumbnail strip (multi-doc) ─────────────────────── */}
          {documents.length > 1 && (
            <div className="flex-shrink-0 h-16 bg-slate-900/80 backdrop-blur border-t border-white/10 flex items-center justify-center gap-2 px-4 overflow-x-auto">
              {documents.map((doc, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveIndex(i); onIndexChange?.(i) }}
                  className={cn(
                    'flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 transition-all',
                    i === activeIndex
                      ? 'border-primary-400 ring-2 ring-primary-400/30 scale-110'
                      : 'border-transparent opacity-60 hover:opacity-100 hover:border-white/30'
                  )}
                  title={doc.title}
                  aria-label={`View document ${i + 1}: ${doc.title}`}
                  aria-pressed={i === activeIndex}
                >
                  {doc.previewUrl && isImage(doc.fileFormat, doc.previewUrl) ? (
                    <img
                      src={doc.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ── Small helpers ────────────────────────────────────────────────────

const ToolbarBtn = ({ children, className, ...props }) => (
  <button
    className={cn(
      'w-8 h-8 rounded-lg flex items-center justify-center',
      'text-slate-400 hover:text-white hover:bg-white/10',
      'transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
      className
    )}
    {...props}
  >
    {children}
  </button>
)

const NavBtn = ({ direction, onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={cn(
      'absolute top-1/2 -translate-y-1/2 z-10',
      'w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700',
      'flex items-center justify-center text-white',
      'border border-white/10 backdrop-blur transition-all',
      'hover:scale-110 active:scale-95',
      direction === 'left'  ? 'left-4'  : 'right-4'
    )}
    aria-label={title}
  >
    {direction === 'left'
      ? <ChevronLeft className="w-5 h-5" />
      : <ChevronRight className="w-5 h-5" />
    }
  </button>
)

const NoPreview = ({ message }) => (
  <div className="flex flex-col items-center gap-3 text-slate-500">
    <AlertCircle className="w-12 h-12" />
    <p className="text-sm">{message}</p>
  </div>
)

export default DocumentPreviewModal
