import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  Star,
  Briefcase,
  CheckCircle2,
  XCircle,
  ShieldBan,
  ShieldCheck,
  ShieldX,
  Ban,
  RefreshCw,
  User,
  Clock,
  Hash,
  Globe,
  Trash2,
  FileText,
} from 'lucide-react'
import { getPartnerById } from '@/api/partner.api'
import { getVerificationDetail } from '@/api/verification.api'
import usePartnerMutations from '@/hooks/usePartnerMutations'
import useVerificationMutations from '@/hooks/useVerificationMutations'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import RejectModal from '@/components/ui/RejectModal'
import ReasonModal from '@/components/ui/ReasonModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import DocumentPreviewModal from '@/components/ui/DocumentPreviewModal'
import DocumentCard from '@/components/verification/DocumentCard'
import {
  formatDate,
  formatDateTime,
  getVerificationVariant,
  getAccountVariant,
} from '@/utils/formatters'
import { useAuth } from '@/contexts/AuthContext'

// ── Small presentational helpers ────────────────────────────────────

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-400 mb-0.5 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-slate-800 break-words">{value || '—'}</p>
    </div>
  </div>
)

const SectionCard = ({ title, children }) => (
  <Card>
    <Card.Header>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    </Card.Header>
    <Card.Body>{children}</Card.Body>
  </Card>
)

const SummaryBadge = ({ label, value, color }) => (
  <div className={`flex flex-col items-center px-4 py-2.5 rounded-xl border ${color} min-w-[70px]`}>
    <span className="text-lg font-bold tabular-nums">{value}</span>
    <span className="text-xs mt-0.5 opacity-75">{label}</span>
  </div>
)

// ── Main component ───────────────────────────────────────────────────

const PartnerDetailPage = () => {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { admin } = useAuth()

  // ── Modal state ────────────────────────────────────────────────────
  const [modals, setModals] = useState({
    approve:      false,
    reject:       false,
    block:        false,
    unblock:      false,
    suspend:      false,
    reactivate:   false,
    delete:       false,
    // doc-level
    rejectDoc:    false,
    forceApprove: false,
    forceReject:  false,
  })
  const openModal  = (key) => setModals((m) => ({ ...m, [key]: true }))
  const closeModal = (key) => setModals((m) => ({ ...m, [key]: false }))

  // Active document being actioned (reject flow)
  const [activeDocument, setActiveDocument] = useState(null)

  // Document preview modal
  const [previewOpen, setPreviewOpen]   = useState(false)
  const [previewDocs, setPreviewDocs]   = useState([])
  const [previewIndex, setPreviewIndex] = useState(0)

  // ── Data fetch ─────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['partner', id],
    queryFn:  () => getPartnerById(id),
    enabled:  !!id,
  })

  const { data: verData, isLoading: verLoading } = useQuery({
    queryKey: ['verificationDetail', id],
    queryFn:  () => getVerificationDetail(id),
    enabled:  !!id,
  })

  const partner   = data?.partner
  const documents = verData?.documents || []
  const session   = verData?.session
  const summary   = verData?.summary

  // ── Partner mutations (account management) ─────────────────────────
  const {
    approveMutation,
    rejectMutation,
    blockMutation,
    unblockMutation,
    suspendMutation,
    reactivateMutation,
    deleteMutation,
  } = usePartnerMutations(id, {
    onApprove:    () => closeModal('approve'),
    onReject:     () => closeModal('reject'),
    onBlock:      () => closeModal('block'),
    onUnblock:    () => closeModal('unblock'),
    onSuspend:    () => closeModal('suspend'),
    onReactivate: () => closeModal('reactivate'),
    onDelete:     () => { closeModal('delete'); navigate('/partners', { replace: true }) },
  })

  // ── Verification mutations (document review) ───────────────────────
  const {
    approveDocumentMutation,
    rejectDocumentMutation,
    forceApproveMutation,
    forceRejectMutation,
    isAnyPending: isVerPending,
  } = useVerificationMutations(id, {
    onDocumentReject: () => { closeModal('rejectDoc'); setActiveDocument(null) },
    onForceApprove:   () => closeModal('forceApprove'),
    onForceReject:    () => closeModal('forceReject'),
  })

  // ── Doc preview handler ────────────────────────────────────────────
  const handlePreview = useCallback((doc) => {
    const entries = []
    let startIndex = 0
    let found = false
    for (const d of documents) {
      const urls = d.previewUrls?.length ? d.previewUrls : d.previewUrl ? [d.previewUrl] : []
      if (!urls.length) continue
      if (d.documentId === doc.documentId && !found) { startIndex = entries.length; found = true }
      urls.forEach((url, idx) => {
        entries.push({
          documentId: d.documentId,
          previewUrl: url,
          fileFormat: d.fileFormat || null,
          title: urls.length > 1 ? `${d.title} (${idx + 1}/${urls.length})` : d.title,
        })
      })
    }
    setPreviewDocs(entries)
    setPreviewIndex(Math.max(0, startIndex))
    setPreviewOpen(true)
  }, [documents])

  const handleDocApprove = useCallback((doc) => {
    approveDocumentMutation.mutate({ documentId: doc.documentId, note: '' })
  }, [approveDocumentMutation])

  const handleDocReject = useCallback((doc) => {
    setActiveDocument(doc)
    openModal('rejectDoc')
  }, [])

  // ── Loading / error states ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-4">
            <Skeleton.DetailCard />
            <Skeleton.DetailCard />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton.DetailCard />
            <Skeleton.DetailCard />
            <Skeleton.DetailCard />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !partner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-sm text-slate-500">Partner not found or failed to load.</p>
        <Button variant="secondary" onClick={() => navigate('/partners')}>
          Back to Partners
        </Button>
      </div>
    )
  }

  const canVerify    = admin?.role === 'SUPER_ADMIN' || admin?.role === 'ADMIN'
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN'

  const address = [
    partner.address?.house,
    partner.address?.street,
    partner.address?.locality,
    partner.address?.city,
    partner.address?.state,
    partner.address?.pincode,
  ].filter(Boolean).join(', ')

  const canForceApprove = true   // always allow; backend handles idempotency
  const canForceReject  = session?.overallStatus !== 'Rejected'

  return (
    <>
      <motion.div
        className="space-y-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
            <div className="h-5 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-slate-800">{partner.fullName}</h1>
              <p className="text-xs text-slate-400">{partner.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge
              label={partner.verificationStatus}
              variant={getVerificationVariant(partner.verificationStatus)}
              size="md"
            />
            <StatusBadge
              label={partner.accountStatus}
              variant={getAccountVariant(partner.accountStatus)}
              size="md"
            />
          </div>
        </div>

        {/* ── Content grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Left column ─────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Profile card */}
            <Card>
              <Card.Body className="flex flex-col items-center text-center py-6">
                <Avatar
                  src={partner.profilePhoto}
                  name={partner.fullName}
                  size="xl"
                  className="mb-4 ring-4 ring-slate-100"
                />
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
                <div className="grid grid-cols-3 gap-3 w-full mt-5 pt-4 border-t border-slate-100">
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-800 tabular-nums flex items-center justify-center gap-0.5">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" aria-hidden="true" />
                      {partner.averageRating?.toFixed(1) || '—'}
                    </p>
                    <p className="text-xs text-slate-400">Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-800 tabular-nums">{partner.completedJobs || 0}</p>
                    <p className="text-xs text-slate-400">Jobs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-800 tabular-nums">{partner.totalReviews || 0}</p>
                    <p className="text-xs text-slate-400">Reviews</p>
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* ── Verification actions (force approve / reject) ── */}
            {canVerify && (
              <Card>
                <Card.Header>
                  <h3 className="text-sm font-semibold text-slate-700">Verification Decision</h3>
                </Card.Header>
                <Card.Body className="space-y-2">
                  {summary && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      <SummaryBadge label="Total"    value={summary.total}       color="bg-slate-50 border-slate-200 text-slate-700" />
                      <SummaryBadge label="Approved" value={summary.approved}    color="bg-emerald-50 border-emerald-200 text-emerald-700" />
                      <SummaryBadge label="Review"   value={summary.underReview} color="bg-blue-50 border-blue-200 text-blue-700" />
                      <SummaryBadge label="Rejected" value={summary.rejected}    color="bg-red-50 border-red-200 text-red-700" />
                    </div>
                  )}
                  <Button
                    variant="success"
                    fullWidth
                    size="md"
                    leftIcon={<ShieldCheck className="w-4 h-4" />}
                    onClick={() => openModal('forceApprove')}
                    disabled={!canForceApprove || isVerPending}
                    title={!canForceApprove ? 'Already approved' : 'Approve all documents and verify partner'}
                  >
                    Approve Partner
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    size="md"
                    leftIcon={<ShieldX className="w-4 h-4" />}
                    onClick={() => openModal('forceReject')}
                    disabled={!canForceReject || isVerPending}
                    title={!canForceReject ? 'Already rejected' : 'Reject entire verification'}
                  >
                    Reject Partner
                  </Button>
                  <p className="text-xs text-slate-400 text-center pt-1">
                    Overrides individual document decisions
                  </p>
                </Card.Body>
              </Card>
            )}

            {/* Account management */}
            {canVerify && (
              <Card>
                <Card.Header>
                  <h3 className="text-sm font-semibold text-slate-700">Account</h3>
                </Card.Header>
                <Card.Body className="space-y-2">
                  {partner.accountStatus !== 'Blocked' ? (
                    <Button variant="outline" fullWidth size="sm" leftIcon={<Ban className="w-3.5 h-3.5" />} onClick={() => openModal('block')}>Block</Button>
                  ) : (
                    <Button variant="outline" fullWidth size="sm" leftIcon={<ShieldCheck className="w-3.5 h-3.5" />} onClick={() => openModal('unblock')}>Unblock</Button>
                  )}
                  {partner.accountStatus !== 'Suspended' ? (
                    <Button variant="outline" fullWidth size="sm" leftIcon={<ShieldBan className="w-3.5 h-3.5" />} onClick={() => openModal('suspend')} disabled={partner.accountStatus === 'Blocked'}>Suspend</Button>
                  ) : (
                    <Button variant="outline" fullWidth size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => openModal('reactivate')}>Reactivate</Button>
                  )}
                  {isSuperAdmin && (
                    <Button variant="ghost" fullWidth size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-400" />} onClick={() => openModal('delete')} className="text-red-500 hover:bg-red-50 hover:text-red-600 mt-1">
                      Delete account
                    </Button>
                  )}
                </Card.Body>
              </Card>
            )}
          </div>

          {/* ── Right columns ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Basic information */}
            <SectionCard title="Basic Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoRow icon={User}     label="Full Name"     value={partner.fullName} />
                <InfoRow icon={Phone}    label="Phone"         value={partner.phone} />
                <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(partner.dateOfBirth)} />
                <InfoRow icon={User}     label="Gender"        value={partner.gender} />
                <InfoRow icon={MapPin}   label="Address"       value={address || '—'} />
                <InfoRow icon={Clock}    label="Registered"    value={formatDateTime(partner.createdAt)} />
              </div>
            </SectionCard>

            {/* KYC details */}
            <SectionCard title="KYC Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoRow icon={Hash} label="Aadhaar Number" value={partner.aadhaarNumber ? partner.aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') : '—'} />
                <InfoRow icon={Hash} label="PAN Number" value={partner.panNumber || '—'} />
                <InfoRow icon={ShieldCheck} label="Phone Verified"    value={partner.verification?.phoneVerified    ? 'Yes' : 'No'} />
                <InfoRow icon={ShieldCheck} label="Identity Verified" value={partner.verification?.identityVerified ? 'Yes' : 'No'} />
              </div>
            </SectionCard>

            {/* Professional details */}
            <SectionCard title="Professional Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoRow icon={Briefcase} label="Experience" value={partner.experience ? `${partner.experience} year${partner.experience !== 1 ? 's' : ''}` : '—'} />
                <InfoRow icon={Globe}     label="Languages"  value={partner.languages?.join(', ') || '—'} />
                <InfoRow icon={Star}      label="Avg Rating" value={partner.averageRating ? `${partner.averageRating.toFixed(2)} / 5.0` : 'Not rated'} />
                <InfoRow icon={Briefcase} label="Completed Jobs" value={partner.completedJobs || 0} />
                {partner.skills?.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {partner.skills.map((skill) => (
                        <span key={skill} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                {partner.bio && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Bio</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{partner.bio}</p>
                  </div>
                )}
                {partner.workingDays?.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Working Days</p>
                    <div className="flex flex-wrap gap-2">
                      {partner.workingDays.map((wd) => (
                        <div key={wd.day} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
                          <span className="font-medium">{wd.day}</span>
                          {wd.startTime && wd.endTime && <span className="text-blue-500 ml-1">{wd.startTime}–{wd.endTime}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Verification history */}
            <SectionCard title="Verification History">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoRow icon={ShieldCheck} label="Current Status" value={partner.verificationStatus} />
                {partner.verifiedBy && <InfoRow icon={User}  label="Actioned By" value={partner.verifiedBy?.name || 'Admin'} />}
                {partner.verifiedAt && <InfoRow icon={Clock} label="Actioned At" value={formatDateTime(partner.verifiedAt)} />}
                {partner.rejectionReason && (
                  <div className="sm:col-span-2 p-3.5 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-700">{partner.rejectionReason}</p>
                  </div>
                )}
                {partner.statusReason && (
                  <div className="sm:col-span-2 p-3.5 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Account Status Reason</p>
                    <p className="text-sm text-amber-700">{partner.statusReason}</p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* ── KYC Documents with per-doc approve / reject ──── */}
            <Card>
              <Card.Header>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">KYC Documents</h3>
                    {documents.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {documents.length} document{documents.length !== 1 ? 's' : ''} · click any card to preview
                      </p>
                    )}
                  </div>
                  {session?.sessionNumber > 1 && (
                    <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                      Session #{session.sessionNumber} · Re-submitted
                    </span>
                  )}
                </div>
              </Card.Header>
              <Card.Body>
                {verLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => <Skeleton.DetailCard key={n} />)}
                  </div>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <FileText className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">No documents uploaded yet</p>
                    <p className="text-xs text-slate-400">The partner has not submitted any verification documents.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {documents.map((doc) => (
                      <DocumentCard
                        key={doc.documentId}
                        document={doc}
                        onPreview={handlePreview}
                        onApprove={handleDocApprove}
                        onReject={handleDocReject}
                        disabled={isVerPending}
                      />
                    ))}
                  </div>
                )}
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

      {/* ── Force approve verification ─────────────────────────────── */}
      <ConfirmModal
        isOpen={modals.forceApprove}
        onClose={() => closeModal('forceApprove')}
        onConfirm={() => forceApproveMutation.mutate('')}
        title="Approve Partner Verification"
        message={`Approve ${partner.fullName}'s entire verification? This overrides individual document states and grants full platform access.`}
        confirmLabel="Approve Partner"
        confirmVariant="success"
        isLoading={forceApproveMutation.isPending}
      />

      {/* ── Force reject verification ──────────────────────────────── */}
      <ReasonModal
        isOpen={modals.forceReject}
        onClose={() => closeModal('forceReject')}
        onConfirm={(reason) => forceRejectMutation.mutate(reason)}
        title="Reject Partner Verification"
        description={`Reject ${partner.fullName}'s entire verification? A reason is required and will be shared with the partner.`}
        confirmLabel="Reject Partner"
        confirmVariant="danger"
        placeholder="e.g. Multiple documents appear fraudulent. Partner flagged for manual review."
        minLength={10}
        required={true}
        isLoading={forceRejectMutation.isPending}
      />

      {/* ── Reject individual document ─────────────────────────────── */}
      <RejectModal
        isOpen={modals.rejectDoc}
        onClose={() => { closeModal('rejectDoc'); setActiveDocument(null) }}
        onConfirm={(reason) => rejectDocumentMutation.mutate({ documentId: activeDocument?.documentId, reason })}
        partnerName={activeDocument?.title}
        isLoading={rejectDocumentMutation.isPending}
        title="Reject Document"
        description={`Reject "${activeDocument?.title}"? The partner will be notified and can re-upload.`}
      />

      {/* ── Block ─────────────────────────────────────────────────── */}
      <ReasonModal
        isOpen={modals.block}
        onClose={() => closeModal('block')}
        onConfirm={(reason) => blockMutation.mutate(reason)}
        title="Block Partner"
        description={`Block ${partner.fullName}? They will not be able to log in or accept new bookings.`}
        confirmLabel="Block Partner"
        confirmVariant="danger"
        placeholder="e.g. Multiple customer complaints regarding unprofessional behaviour."
        required={false}
        isLoading={blockMutation.isPending}
      />

      {/* ── Unblock ───────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={modals.unblock}
        onClose={() => closeModal('unblock')}
        onConfirm={() => unblockMutation.mutate()}
        title="Unblock Partner"
        message={`Restore ${partner.fullName}'s access? Their account status will be set back to Active.`}
        confirmLabel="Unblock"
        confirmVariant="primary"
        isLoading={unblockMutation.isPending}
      />

      {/* ── Suspend ───────────────────────────────────────────────── */}
      <ReasonModal
        isOpen={modals.suspend}
        onClose={() => closeModal('suspend')}
        onConfirm={(reason) => suspendMutation.mutate(reason)}
        title="Suspend Account"
        description={`Temporarily suspend ${partner.fullName}'s account. They will see an "under review" message in the app.`}
        confirmLabel="Suspend Account"
        confirmVariant="danger"
        placeholder="e.g. Account suspended pending investigation of reported incident."
        minLength={10}
        required={true}
        isLoading={suspendMutation.isPending}
      />

      {/* ── Reactivate ────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={modals.reactivate}
        onClose={() => closeModal('reactivate')}
        onConfirm={() => reactivateMutation.mutate()}
        title="Reactivate Account"
        message={`Lift the suspension on ${partner.fullName}'s account and restore Active status?`}
        confirmLabel="Reactivate"
        confirmVariant="primary"
        isLoading={reactivateMutation.isPending}
      />

      {/* ── Delete ────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={modals.delete}
        onClose={() => closeModal('delete')}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Account"
        message={`Permanently delete ${partner.fullName}'s account? This is a soft delete — data and booking history are preserved but they lose all access. This cannot be undone from the admin panel.`}
        confirmLabel="Delete Account"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  )
}

export default PartnerDetailPage
