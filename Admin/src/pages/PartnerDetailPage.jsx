import { useState } from 'react'
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
  Ban,
  RefreshCw,
  User,
  Clock,
  Hash,
  Globe,
  Trash2,
} from 'lucide-react'
import { getPartnerById } from '@/api/partner.api'
import usePartnerMutations from '@/hooks/usePartnerMutations'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import RejectModal from '@/components/ui/RejectModal'
import ReasonModal from '@/components/ui/ReasonModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import DocumentViewer from '@/components/partners/DocumentViewer'
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

// ── Main component ───────────────────────────────────────────────────

const PartnerDetailPage = () => {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { admin } = useAuth()

  // Modal open/close state — one boolean per modal
  const [modals, setModals] = useState({
    approve:    false,
    reject:     false,
    block:      false,
    unblock:    false,
    suspend:    false,
    reactivate: false,
    delete:     false,
  })

  const openModal  = (key) => setModals((m) => ({ ...m, [key]: true }))
  const closeModal = (key) => setModals((m) => ({ ...m, [key]: false }))

  // ── Data fetch ─────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['partner', id],
    queryFn:  () => getPartnerById(id),
    enabled:  !!id,
  })

  const partner = data?.partner

  // ── Mutations — all centralised in the hook ────────────────────────
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

  // Build full address string
  const address = [
    partner.address?.house,
    partner.address?.street,
    partner.address?.locality,
    partner.address?.city,
    partner.address?.state,
    partner.address?.pincode,
  ].filter(Boolean).join(', ')

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

          {/* Left column */}
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

                {/* Service categories */}
                {partner.categories?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {partner.categories.map((cat) => (
                      <span
                        key={cat._id}
                        className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium"
                      >
                        {cat.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats row */}
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

            {/* Verification actions */}
            {canVerify && (
              <Card>
                <Card.Header>
                  <h3 className="text-sm font-semibold text-slate-700">Verification</h3>
                </Card.Header>
                <Card.Body className="space-y-2">
                  <Button
                    variant="success"
                    fullWidth
                    size="md"
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => openModal('approve')}
                    disabled={
                      partner.verificationStatus === 'Approved' ||
                      partner.verificationStatus === 'Pending'
                    }
                    title={
                      partner.verificationStatus === 'Pending'
                        ? 'Partner has not submitted documents yet'
                        : partner.verificationStatus === 'Approved'
                        ? 'Already approved'
                        : undefined
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    size="md"
                    leftIcon={<XCircle className="w-4 h-4" />}
                    onClick={() => openModal('reject')}
                    disabled={partner.verificationStatus === 'Rejected'}
                  >
                    Reject
                  </Button>
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
                    <Button
                      variant="outline"
                      fullWidth
                      size="sm"
                      leftIcon={<Ban className="w-3.5 h-3.5" />}
                      onClick={() => openModal('block')}
                    >
                      Block
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      fullWidth
                      size="sm"
                      leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                      onClick={() => openModal('unblock')}
                    >
                      Unblock
                    </Button>
                  )}

                  {partner.accountStatus !== 'Suspended' ? (
                    <Button
                      variant="outline"
                      fullWidth
                      size="sm"
                      leftIcon={<ShieldBan className="w-3.5 h-3.5" />}
                      onClick={() => openModal('suspend')}
                      disabled={partner.accountStatus === 'Blocked'}
                    >
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      fullWidth
                      size="sm"
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                      onClick={() => openModal('reactivate')}
                    >
                      Reactivate
                    </Button>
                  )}

                  {/* Soft delete — SUPER_ADMIN only */}
                  {isSuperAdmin && (
                    <Button
                      variant="ghost"
                      fullWidth
                      size="sm"
                      leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                      onClick={() => openModal('delete')}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 mt-1"
                    >
                      Delete account
                    </Button>
                  )}
                </Card.Body>
              </Card>
            )}
          </div>

          {/* Right columns */}
          <div className="lg:col-span-2 space-y-4">

            {/* Basic information */}
            <SectionCard title="Basic Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoRow icon={User}     label="Full Name"    value={partner.fullName} />
                <InfoRow icon={Phone}    label="Phone"        value={partner.phone} />
                <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(partner.dateOfBirth)} />
                <InfoRow icon={User}     label="Gender"       value={partner.gender} />
                <InfoRow icon={MapPin}   label="Address"      value={address || '—'} />
                <InfoRow icon={Clock}    label="Registered"   value={formatDateTime(partner.createdAt)} />
              </div>
            </SectionCard>

            {/* KYC details */}
            <SectionCard title="KYC Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoRow
                  icon={Hash}
                  label="Aadhaar Number"
                  value={partner.aadhaarNumber
                    ? partner.aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')
                    : '—'}
                />
                <InfoRow
                  icon={Hash}
                  label="PAN Number"
                  value={partner.panNumber || '—'}
                />
                <InfoRow
                  icon={ShieldCheck}
                  label="Phone Verified"
                  value={partner.verification?.phoneVerified ? 'Yes' : 'No'}
                />
                <InfoRow
                  icon={ShieldCheck}
                  label="Identity Verified"
                  value={partner.verification?.identityVerified ? 'Yes' : 'No'}
                />
              </div>
            </SectionCard>

            {/* Professional details */}
            <SectionCard title="Professional Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoRow
                  icon={Briefcase}
                  label="Experience"
                  value={partner.experience ? `${partner.experience} year${partner.experience !== 1 ? 's' : ''}` : '—'}
                />
                <InfoRow
                  icon={Globe}
                  label="Languages"
                  value={partner.languages?.join(', ') || '—'}
                />
                <InfoRow
                  icon={Star}
                  label="Average Rating"
                  value={partner.averageRating ? `${partner.averageRating.toFixed(2)} / 5.0` : 'Not rated'}
                />
                <InfoRow
                  icon={Briefcase}
                  label="Completed Jobs"
                  value={partner.completedJobs || 0}
                />
                {/* Skills */}
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Skills</p>
                  {partner.skills?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {partner.skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
                {/* Bio */}
                {partner.bio && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Bio</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{partner.bio}</p>
                  </div>
                )}
                {/* Working days */}
                {partner.workingDays?.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Working Days</p>
                    <div className="flex flex-wrap gap-2">
                      {partner.workingDays.map((wd) => (
                        <div
                          key={wd.day}
                          className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg"
                        >
                          <span className="font-medium">{wd.day}</span>
                          {wd.startTime && wd.endTime && (
                            <span className="text-blue-500 ml-1">
                              {wd.startTime}–{wd.endTime}
                            </span>
                          )}
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
                <InfoRow
                  icon={ShieldCheck}
                  label="Current Status"
                  value={partner.verificationStatus}
                />
                {partner.verifiedBy && (
                  <InfoRow
                    icon={User}
                    label="Actioned By"
                    value={partner.verifiedBy?.name || 'Admin'}
                  />
                )}
                {partner.verifiedAt && (
                  <InfoRow
                    icon={Clock}
                    label="Actioned At"
                    value={formatDateTime(partner.verifiedAt)}
                  />
                )}
                {partner.rejectionReason && (
                  <div className="sm:col-span-2 p-3.5 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-red-700">{partner.rejectionReason}</p>
                  </div>
                )}
                {partner.statusReason && (
                  <div className="sm:col-span-2 p-3.5 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                      Account Status Reason
                    </p>
                    <p className="text-sm text-amber-700">{partner.statusReason}</p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Documents */}
            <DocumentViewer partner={partner} />

          </div>
        </div>
      </motion.div>

      {/* ── Modals ─────────────────────────────────────────────────── */}

      {/* Approve */}
      <ConfirmModal
        isOpen={modals.approve}
        onClose={() => closeModal('approve')}
        onConfirm={() => approveMutation.mutate()}
        title="Approve Partner"
        message={`Approve ${partner.fullName}? They will gain full access to the platform as a verified partner.`}
        confirmLabel="Approve"
        confirmVariant="success"
        isLoading={approveMutation.isPending}
      />

      {/* Reject */}
      <RejectModal
        isOpen={modals.reject}
        onClose={() => closeModal('reject')}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
        partnerName={partner.fullName}
        isLoading={rejectMutation.isPending}
      />

      {/* Block — requires a reason */}
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

      {/* Unblock */}
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

      {/* Suspend — requires a reason (backend enforces ≥ 10 chars) */}
      <ReasonModal
        isOpen={modals.suspend}
        onClose={() => closeModal('suspend')}
        onConfirm={(reason) => suspendMutation.mutate(reason)}
        title="Suspend Account"
        description={`Temporarily suspend ${partner.fullName}'s account. They will see an "under review" message in the app.`}
        confirmLabel="Suspend Account"
        confirmVariant="danger"
        placeholder="e.g. Account suspended pending investigation of reported incident on 18 Jul 2026."
        minLength={10}
        required={true}
        isLoading={suspendMutation.isPending}
      />

      {/* Reactivate */}
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

      {/* Delete — SUPER_ADMIN only, double-confirm */}
      <ConfirmModal
        isOpen={modals.delete}
        onClose={() => closeModal('delete')}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Account"
        message={`Permanently delete ${partner.fullName}'s account? This is a soft delete — their data and booking history are preserved in the database but they lose all access. This cannot be undone from the admin panel.`}
        confirmLabel="Delete Account"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  )
}

export default PartnerDetailPage
