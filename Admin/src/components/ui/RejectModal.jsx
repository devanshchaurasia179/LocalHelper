import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

const schema = z.object({
  reason: z
    .string()
    .min(1, 'Rejection reason is required')
    .min(10, 'Please provide at least 10 characters')
    .max(500, 'Keep the reason under 500 characters'),
})

/**
 * RejectModal — form dialog for rejecting a partner's verification.
 * The reason field is required (backend enforces ≥ 10 chars).
 *
 * Props:
 *   isOpen
 *   onClose()
 *   onConfirm(reason)  — called with the trimmed reason string
 *   partnerName        — shown in the modal heading
 *   isLoading          — disables the confirm button while the API call runs
 */
const RejectModal = ({ isOpen, onClose, onConfirm, partnerName, isLoading = false }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) })

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = ({ reason }) => {
    onConfirm(reason.trim())
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Reject Verification" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-6 py-5 space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-3 p-3.5 bg-red-50 rounded-xl border border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-red-700">Reject {partnerName}?</p>
              <p className="text-xs text-red-500 mt-0.5">
                The partner will be notified with the reason you provide below.
              </p>
            </div>
          </div>

          {/* Reason textarea */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reject-reason"
              className="text-sm font-medium text-slate-700"
            >
              Rejection reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reject-reason"
              rows={4}
              placeholder="e.g. The Aadhaar photo is blurry. Please re-upload a clear image of both sides."
              className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 px-3.5 py-2.5 resize-none
                hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              aria-invalid={!!errors.reason}
              aria-describedby={errors.reason ? 'reject-reason-error' : undefined}
              {...register('reason')}
            />
            {errors.reason && (
              <p id="reject-reason-error" className="text-xs text-red-600" role="alert">
                {errors.reason.message}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <Button type="button" variant="secondary" size="md" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="md" loading={isLoading}>
            Reject Partner
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default RejectModal
