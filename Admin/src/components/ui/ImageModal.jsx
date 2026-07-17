import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * ImageModal — full-screen image viewer with zoom, prev/next, download.
 *
 * Props:
 *   isOpen      — boolean
 *   onClose()   — close callback
 *   images      — [{ url, label }]
 *   initialIndex — which image to open first (default 0)
 */
const ImageModal = ({ isOpen, onClose, images = [], initialIndex = 0 }) => {
  const [index,  setIndex]  = useState(initialIndex)
  const [zoom,   setZoom]   = useState(1)
  const [rotate, setRotate] = useState(0)

  // Reset zoom/rotate when switching images or opening modal
  useEffect(() => {
    if (isOpen) {
      setIndex(initialIndex)
      setZoom(1)
      setRotate(0)
    }
  }, [isOpen, initialIndex])

  const current = images[index]

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length)
    setZoom(1); setRotate(0)
  }, [images.length])

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length)
    setZoom(1); setRotate(0)
  }, [images.length])

  // Keyboard nav
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape')      onClose()
      if (e.key === 'ArrowLeft')   prev()
      if (e.key === 'ArrowRight')  next()
      if (e.key === '+')           setZoom((z) => Math.min(z + 0.25, 3))
      if (e.key === '-')           setZoom((z) => Math.max(z - 0.25, 0.5))
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose, prev, next])

  const handleDownload = () => {
    if (!current?.url) return
    const a = document.createElement('a')
    a.href = current.url
    a.download = current.label || 'document'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && current && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ backgroundColor: 'rgba(2, 6, 23, 0.92)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Image viewer: ${current.label}`}
        >
          {/* Top toolbar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">{current.label}</span>
              <span className="text-slate-400 text-xs">
                {index + 1} / {images.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom out */}
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-slate-300 text-xs w-12 text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              {/* Zoom in */}
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {/* Rotate */}
              <button
                onClick={() => setRotate((r) => (r + 90) % 360)}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Rotate image"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              {/* Download */}
              <button
                onClick={handleDownload}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Download image"
              >
                <Download className="w-4 h-4" />
              </button>
              {/* Close */}
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors ml-1"
                aria-label="Close viewer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image area */}
          <div className="flex-1 flex items-center justify-center overflow-hidden relative px-16">
            {/* Prev */}
            {images.length > 1 && (
              <button
                onClick={prev}
                className="absolute left-4 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <motion.img
              key={`${index}-${rotate}`}
              src={current.url}
              alt={current.label}
              className="max-h-full max-w-full object-contain select-none"
              style={{
                transform: `scale(${zoom}) rotate(${rotate}deg)`,
                transition: 'transform 0.2s ease',
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: zoom }}
              draggable={false}
            />

            {/* Next */}
            {images.length > 1 && (
              <button
                onClick={next}
                className="absolute right-4 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex items-center justify-center gap-2 py-4 px-4 flex-shrink-0">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => { setIndex(i); setZoom(1); setRotate(0) }}
                  className={cn(
                    'w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0',
                    i === index ? 'border-primary-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-75'
                  )}
                  aria-label={`View ${img.label}`}
                  aria-current={i === index ? 'true' : undefined}
                >
                  <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
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

export default ImageModal
