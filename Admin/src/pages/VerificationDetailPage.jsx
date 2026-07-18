import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  ShieldX,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  Star,
  Briefcase,
  AlertTriangle,
  Hash,
  CalendarDays,
} from 'lucide-react'
import { getVerificationDetail } from '@/api/verification.api'
import useVerificationMutations from '@/hooks/useVerificationMutations'
import DocumentCard from '@/components/verification/DocumentCard'
import DocumentPreviewModal from '@/components/ui/DocumentPreviewModal'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import RejectModal from '@/components/ui/RejectModal'
import ReasonModal from '@/components/ui/ReasonModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import PageHeader from '@/components/ui/PageHeader'
import {
  formatDate,
  formatDateTime,
  getVerificationVariant,
} from '@/utils/formatters'

// ── Session status display config ────────────────────────────────────
const SESSION_STATUS_CONFIG = {
  Approved:       { variant: 'success', label: 'Approved' },
  Rejected:       { variant: 'danger',  label: 'Rejected' },
  'Under Review': { variant: 'info',    label: 'Under Review' },
  Pending:        { variant: 'warning', label: 'Pending' },
  'In Progress':  { variant: 'warning', label: 'In Progress' },
  'Re-submitted': { variant: 'info',    label: 'Re-submitted' },
}

// ── Summary stat mini-card ───────────────────────────────────────────
const SummaryBadge = ({ label, value, color }) => (
  <div className={`flex flex-col items-center px-4 py-2.5 rounded-xl border ${color} min-w-[70px]`}>
    <span className="text-lg font-bold tabular-nums">{value}</span>
    <span className="text-xs mt-0.5 opacity-75">{label}</span>
  </div>
)

// ── History entry ────────────────────────────────────────────────────
const HistoryEntry = ({ entry }) => {
  const statusCfg = SESSION_STATUS_CONFIG[entry.status] || { variant: 'default', label: entry.status }
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0 mt-2" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge label={statusCfg.label} variant={statusCfg.variant} size="sm" />
          <span className="text-xs text-slate-500 font-medium">{entry.changedByName || entry.changedByRole}</span>
        </div>
        {entry.note && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{entry.note}</p>
        )}
        <p className="text-xs text-slate-400 mt-1">{formatDateTime(entry.changedAt)}</p>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────
const VerificationDetailPage = () => {
  const { partnerId } = useParams()
  const navigate = useNavigate()

  // ── Preview modal state ───────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDocs, setPreviewDocs] = useState([])
  const [previewIndex, setPreviewIndex] = useState(0)

  // ── Action modal state ────────────────────────────────────────────
  const [activeDocument, setActiveDocument] = useState(null) // doc being actioned
  const [modals, setModals] = useState({
    rejectDoc:     false,
    forceApprove:  false,
    forceReject:   false,
  })
  const openModal  = (key) => setModals((m) => ({ ...m, [key]: true }))
  const closeModal = (key) => setModals((m) => ({ ...m, [key]: false }))

  // ── Data fetch ────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['verificationDetail', partnerId],
    queryFn:  () => getVerificationDetail(partnerId),
    enabled:  !!partnerId,
  })

  const { partner, session, summary, documents = [] } = data || {}

  // ── Mutations ─────────────────────────────────────────────────────
  const {
    approveDocumentMutation,
    rejectDocumentMutation,
    forceApproveMutation,
    forceRejectMutation,
    isAnyPending,
  } = useVerificationMutations(partnerId, {
    onDocumentReject: () => closeModal('rejectDoc'),
    onForceApprove:   () => closeModal('forceApprove'),
    onForceReject:    () => closeModal('forceReject'),
  })

  // ── Handlers ──────────────────────────────────────────────────────
  const handlePreview = useCallback((doc) => {
    // Open with this doc; allow navigating to others from the modal
    const allWithPreview = documents.filter((d) => d.previewUrl)
    const idx = allWithPreview.findIndex((d) => d.documentId === doc.documentId)
    setPreviewDocs(allWithPreview)
    setPreviewIndex(Math.max(0, idx))
    setPreviewOpen(true)
  }, [documents])

  const handleApprove = useCallback((doc) => {
    // Immediate — no confirmation modal needed for approve
    approveDocumentMutation.mutate({ documentId: doc.documentId, note: '' })
  }, [approveDocumentMutation])

  const handleReject = useCallback((doc) => {
    setActiveDocument(doc)
    openModal('rejectDoc')
  }, [])

  // ── Loading state ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton.DetailCard />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton.DetailCard />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((n) => <Skeleton.DetailCard key={n} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !partner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-10 h-10 text-slate-300" />
        <p className="text-sm text-slate-500">Could not load verification details.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} leftIcon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
          <Button variant="secondary" size="sm" onClick={refetch}>Retry</Button>
        </div>
      </div>
    )
  }

  const sessionStatus = session?.overallStatus
  const sessionCfg    = SESSION_STATUS_CONFIG[sessionStatus] || { variant: 'default', label: sessionStatus }

  const address = [partner.address?.locality, partner.address?.city, partner.address?.state]
    .filter(Boolean).join(', ')

  const canForceApprove = sessionStatus !== 'Approved'
  const canForceReject  = sessionStatus !== 'Rejected'

  return (
    <>
      <motion.div
        className="space-y-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* ── Page header ──────────────────────────────────────────── */}
        <PageHeader
          title={partner.fullName}
          subtitle={`Verification Review · Session #${session?.sessionNumber ?? 1}`}
          actions={
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Partner profile card */}
            <Card>
              <Card.Body className="flex flex-col items-center text-center py-6">
                <Avatar src={partner.profilePhoto} name={partner.fullName} size="xl" className="mb-4 ring-4 ring-slate-100" />
                <h2 className="text-base font-bold text-slate-800">{partner.fullName}</h2>
                <p className="text-sm text-slate-400 mt-0.5">{partner.phone}</p>

                {partner.categories?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {partner.categories.map((cat) => (
                      <span key={cat._id} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">
                        {cat.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs truncate">{address || '—'}</span>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3 w-full mt-4 pt-4 border-t border-slate-100">
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-800 flex items-center justify-center gap-0.5">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      {partner.averageRating?.toFixed(1) || '—'}
                    </p>
                    <p className="text-xs text-slate-400">Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-800">{partner.completedJobs || 0}</p>
                    <p className="text-xs text-slate-400">Jobs</p>
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* Session info */}
            {session && (
              <Card>
                <Card.Header>
                  <h3 className="text-sm font-semibold text-slate-700">Session Details</h3>
                </Card.Header>
                <Card.Body className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Status</span>
                    <StatusBadge label={sessionCfg.label} variant={sessionCfg.variant} />
                  </div>
                  {session.submittedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Submitted</span>
                      <span className="text-xs font-medium text-slate-700">{formatDate(session.submittedAt)}</span>
                    </div>
                  )}
                  {session.reviewedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Reviewed</span>
                      <span className="text-xs font-medium text-slate-700">{formatDate(session.reviewedAt)}</span>
                    </div>
                  )}
                  {session.reviewedBy && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Reviewed by</span>
                      <span className="text-xs font-medium text-slate-700">{session.reviewedBy.name}</span>
                    </div>
                  )}
                  {session.reviewNotes && (
                    <div className="pt-2 border-t border-slate-50">
                      <p className="text-xs text-slate-400 mb-1">Review Notes</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{session.reviewNotes}</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}

            {/* Document summary */}
            {summary && (
              <Card>
                <Card.Header>
                  <h3 className="text-sm font-semibold text-slate-700">Document Summary</h3>
                </Card.Header>
                <Card.Body>
                  <div className="flex flex-wrap gap-2">
                    <SummaryBadge label="Total"    value={summary.total}       color="bg-slate-50 border-slate-200 text-slate-700" />
                    <SummaryBadge label="Approved" value={summary.approved}    color="bg-emerald-50 border-emerald-200 text-emerald-700" />
                    <SummaryBadge label="Review"   value={summary.underReview} color="bg-blue-50 border-blue-200 text-blue-700" />
                    <SummaryBadge label="Rejected" value={summary.rejected}    color="bg-red-50 border-red-200 text-red-700" />
                    {summary.pending > 0 && (
                      <SummaryBadge label="Pending" value={summary.pending}   color="bg-amber-50 border-amber-200 text-amber-700" />
                    )}
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Overall actions */}
            <Card>
              <Card.Header>
                <h3 className="text-sm font-semibold text-slate-700">Overall Decision</h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                <Button
                  variant="success"
                  fullWidth
                  size="md"
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                  onClick={() => openModal('forceApprove')}
                  disabled={!canForceApprove || isAnyPending}
                  title={!canForceApprove ? 'Already approved' : 'Override and approve entire verification'}
                >
                  Approve Partner
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  size="md"
                  leftIcon={<ShieldX className="w-4 h-4" />}
                  onClick={() => openModal('forceReject')}
                  disabled={!canForceReject || isAnyPending}
                  title={!canForceReject ? 'Already rejected' : 'Override and reject entire verification'}
                >
                  Reject Partner
                </Button>
                <p className="text-xs text-slate-400 text-center pt-1">
                  These override individual document decisions
                </p>
              </Card.Body>
            </Card>

            {/* History */}
            {session?.history?.length > 0 && (
              <Card>
                <Card.Header>
                  <h3 className="text-sm font-semibold text-slate-700">
                    Audit Trail
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      ({session.history.length} entries)
                    </span>
                  </h3>
                </Card.Header>
                <Card.Body className="py-2 max-h-72 overflow-y-auto">
                  {[...session.history].reverse().map((entry, i) => (
                    <HistoryEntry key={i} entry={entry} />
                  ))}
                </Card.Body>
              </Card>
            )}
          </div>

          {/* ── Right columns — Documents ─────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                Verification Documents
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({documents.length} document{documents.length !== 1 ? 's' : ''})
                </span>
              </h2>
            </div>

            {documents.length === 0 ? (
              <Card>
                <Card.Body className="flex flex-col items-center py-12 text-center gap-3">
                  <FileText className="w-10 h-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">No documents uploaded yet</p>
                  <p className="text-xs text-slate-400">
                    The partner has not submitted any verification documents.
                  </p>
                </Card.Body>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.documentId}
                    document={doc}
                    onPreview={handlePreview}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    disabled={isAnyPending}
                  />
                ))}
              </div>
            )}

            {/* Partner basic info summary below documents */}
            <Card>
              <Card.Header>
                <h3 className="text-sm font-semibold text-slate-700">Partner Info</h3>
              </Card.Header>
              <Card.Body>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow icon={User}        label="Full Name"     value={partner.fullName} />
                  <InfoRow icon={Phone}       label="Phone"         value={partner.phone} />
                  <InfoRow icon={MapPin}      label="City"          value={partner.address?.city || '—'} />
                  <InfoRow icon={Briefcase}   label="Experience"    value={partner.experience ? `${partner.experience} yr${partner.experience !== 1 ? 's' : ''}` : '—'} />
                  <InfoRow icon={CalendarDays} label="Registered"   value={formatDate(partner.createdAt)} />
                  <InfoRow icon={ShieldCheck} label="Account"       value={partner.accountStatus} />
                  <InfoRow
                    icon={ShieldCheck}
                    label="Verification"
                    value={
                      <StatusBadge
                        label={partner.verificationStatus}
                        variant={getVerificationVariant(partner.verificationStatus)}
                      />
                    }
                  />
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      </motion.div>

      {/* ── Document preview modal ─────────────────────────────────── */}
      <DocumentPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        documents={previewDocs}
        currentIndex={previewIndex}
        onIndexChange={setPreviewIndex}
      />

      {/* ── Reject document modal ──────────────────────────────────── */}
      <RejectModal
        isOpen={modals.rejectDoc}
        onClose={() => { closeModal('rejectDoc'); setActiveDocument(null) }}
        onConfirm={(reason) =>
          rejectDocumentMutation.mutate({ documentId: activeDocument?.documentId, reason })
        }
        partnerName={activeDocument?.title}
        isLoading={rejectDocumentMutation.isPending}
        title="Reject Document"
        description={`Reject "${activeDocument?.title}"? The partner will be notified and can re-upload.`}
      />

      {/* ── Force approve modal ────────────────────────────────────── */}
      <ConfirmModal
        isOpen={modals.forceApprove}
        onClose={() => closeModal('forceApprove')}
        onConfirm={() => forceApproveMutation.mutate('')}
        title="Approve Partner Verification"
        message={`Approve ${partner.fullName}'s entire verification? This overrides individual document states. The partner will gain full platform access.`}
        confirmLabel="Approve Partner"
        confirmVariant="success"
        isLoading={forceApproveMutation.isPending}
      />

      {/* ── Force reject modal ─────────────────────────────────────── */}
      <ReasonModal
        isOpen={modals.forceReject}
        onClose={() => closeModal('forceReject')}
        onConfirm={(reason) => forceRejectMutation.mutate(reason)}
        title="Reject Partner Verification"
        description={`Reject ${partner.fullName}'s entire verification? A reason is required and will be shared with the partner.`}
        confirmLabel="Reject Partner"
        confirmVariant="danger"
        placeholder="e.g. Multiple documents appear fraudulent. Partner has been flagged for manual review."
        minLength={10}
        required={true}
        isLoading={forceRejectMutation.isPending}
      />
    </>
  )
}

// ── InfoRow helper ───────────────────────────────────────────────────
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2.5 min-w-0">
    <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      {typeof value === 'string' || typeof value === 'number'
        ? <p className="text-sm font-medium text-slate-700 break-words">{value}</p>
        : <div className="mt-0.5">{value}</div>
      }
    </div>
  </div>
)

export default VerificationDetailPage
