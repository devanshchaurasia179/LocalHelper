import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, Info } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

/**
 * ReasonModal — generic modal that requires a text reason before confirming.
 * Used for: Block, Suspend (both need a reason stored on the partner record).
 *
 * Props:
 *   isOpen
 *   onClose()
 *   onConfirm(reason: string)
 *   title
 *   description       — shown below the icon banner
 *   confirmLabel
 *   confirmVariant    — 'danger' | 'warning' | 'primary'
 *   placeholder       — textarea placeholder
 *   minLength         — min reason length (default 10, matches backend)
 *   isLoading
 *   required          — whether reason is required (default true)
 */
const ReasonModal = ({
  isOpen,
  onClose,
  onConfirm,
  title         = 'Confirm Action',
  description,
  confirmLabel  = 'Confirm',
  confirmVariant = 'danger',
  placeholder   = 'Provide a reason...',
  minLength     = 10,
  isLoading     = false,
  required      = true,
}) => {
  const schema = z.object({
    reason: required
      ? z.string().min(1, 'Reason is required').min(minLength, `At least ${minLength} characters required`).max(500)
      : z.string().max(500).optional(),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) })

  // Reset form whenever modal opens/closes
  useEffect(() => {
    if (!isOpen) reset()
  }, [isOpen, reset])

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = ({ reason }) => {
    onConfirm(reason?.trim() || '')
  }

  const isDanger = confirmVariant === 'danger'

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-6 py-5 space-y-4">
          {/* Banner */}
          {description && (
            <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${
              isDanger
                ? 'bg-red-50 border-red-100'
                : 'bg-amber-50 border-amber-100'
            }`}>
              {isDanger ? (
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <p className={`text-sm ${isDanger ? 'text-red-700' : 'text-amber-700'}`}>
                {description}
              </p>
            </div>
          )}

          {/* Reason textarea */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason-input" className="text-sm font-medium text-slate-700">
              Reason {required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              id="reason-input"
              rows={3}
              placeholder={placeholder}
              className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-800
                placeholder:text-slate-400 px-3.5 py-2.5 resize-none
                hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500
                focus:border-transparent transition-colors"
              aria-invalid={!!errors.reason}
              aria-describedby={errors.reason ? 'reason-error' : undefined}
              {...register('reason')}
            />
            {errors.reason && (
              <p id="reason-error" className="text-xs text-red-600" role="alert">
                {errors.reason.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <Button type="button" variant="secondary" size="md" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant={confirmVariant} size="md" loading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ReasonModal
