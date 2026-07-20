import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, ImageOff, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { getVerificationDetail } from '@/api/verification.api'
import ImageModal from '@/components/ui/ImageModal'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'

/**
 * DocumentViewer — displays KYC documents uploaded via the dynamic verification system.
 * Fetches documents from the PartnerDocument collection via the verification API.
 * Clicking any card opens the full ImageModal viewer with prev/next navigation.
 *
 * Props:
 *   partner — full partner object from the API (needs partner._id)
 */
const DocumentViewer = ({ partner }) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [startIndex, setStartIndex] = useState(0)

  // Fetch verification documents from the dedicated verification endpoint
  const { data, isLoading } = useQuery({
    queryKey: ['verification-detail', partner._id],
    queryFn: () => getVerificationDetail(partner._id),
    enabled: !!partner._id,
  })

  const documents = data?.documents?.filter((d) => d.previewUrl) || []

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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-6 h-6 text-slate-300 animate-spin mb-2" aria-hidden="true" />
              <p className="text-sm text-slate-400">Loading documents…</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ImageOff className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
              <p className="text-sm text-slate-400">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {documents.map((doc, i) => (
                <DocumentCard
                  key={doc.documentId || doc.key}
                  label={doc.title}
                  url={doc.previewUrl}
                  status={doc.status}
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
        images={documents.map((d) => ({ url: d.previewUrl, label: d.title }))}
        initialIndex={startIndex}
      />
    </>
  )
}

/**
 * DocumentCard — individual document thumbnail.
 * Uses loading="lazy" for performance.
 * Shows a status badge overlay (Approved / Rejected / Under Review).
 */
const DocumentCard = ({ label, url, status, onClick }) => {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  const statusVariant =
    status === 'Approved'     ? 'success' :
    status === 'Rejected'     ? 'danger'  :
    status === 'Under Review' ? 'warning' : 'default'

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

      {/* Label + status */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
        <span className="text-xs font-medium text-white block">{label}</span>
        {status && (
          <StatusBadge label={status} variant={statusVariant} size="sm" showDot={false} className="mt-0.5" />
        )}
      </div>
    </button>
  )
}

export default DocumentViewer
