import { useState } from 'react'
import { Eye, ImageOff } from 'lucide-react'
import { cn } from '@/utils/cn'
import ImageModal from '@/components/ui/ImageModal'
import Card from '@/components/ui/Card'

/**
 * DocumentViewer — displays KYC documents as lazy-loading thumbnail cards.
 * Clicking any card opens the full ImageModal viewer with prev/next navigation.
 *
 * Props:
 *   partner — full partner object from the API
 */
const DocumentViewer = ({ partner }) => {
  const [modalOpen,  setModalOpen]  = useState(false)
  const [startIndex, setStartIndex] = useState(0)

  // Build document list — only include docs that have a URL
  const documents = [
    { key: 'selfie',      label: 'Selfie',        image: partner.selfie },
    { key: 'aadhaarFront', label: 'Aadhaar Front', image: partner.aadhaarFront },
    { key: 'aadhaarBack',  label: 'Aadhaar Back',  image: partner.aadhaarBack },
    { key: 'panImage',     label: 'PAN Card',       image: partner.panImage },
  ].filter((d) => d.image?.url)

  const openAt = (index) => {
    setStartIndex(index)
    setModalOpen(true)
  }

  return (
    <>
      <Card>
        <Card.Header>
          <h3 className="text-sm font-semibold text-slate-800">KYC Documents</h3>
          <p className="text-xs text-slate-400 mt-0.5">Click any image to view full-screen</p>
        </Card.Header>
        <Card.Body>
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ImageOff className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
              <p className="text-sm text-slate-400">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {documents.map((doc, i) => (
                <DocumentCard
                  key={doc.key}
                  label={doc.label}
                  url={doc.image.url}
                  onClick={() => openAt(i)}
                />
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Full-screen viewer */}
      <ImageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        images={documents.map((d) => ({ url: d.image.url, label: d.label }))}
        initialIndex={startIndex}
      />
    </>
  )
}

/**
 * DocumentCard — individual document thumbnail.
 * Uses loading="lazy" for performance.
 */
const DocumentCard = ({ label, url, onClick }) => {
  const [loaded,  setLoaded]  = useState(false)
  const [errored, setErrored] = useState(false)

  return (
    <button
      onClick={onClick}
      className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-primary-300 transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
      aria-label={`View ${label}`}
    >
      {!loaded && !errored && (
        <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden="true" />
      )}

      {errored ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <ImageOff className="w-5 h-5 text-slate-300" aria-hidden="true" />
          <span className="text-xs text-slate-400">Load failed</span>
        </div>
      ) : (
        <img
          src={url}
          alt={label}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-primary-900/0 group-hover:bg-primary-900/30 transition-colors flex items-center justify-center">
        <Eye
          className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden="true"
        />
      </div>

      {/* Label */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5">
        <span className="text-xs font-medium text-white">{label}</span>
      </div>
    </button>
  )
}

export default DocumentViewer
