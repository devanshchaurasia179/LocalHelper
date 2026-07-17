import { AlertTriangle, Info } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

/**
 * ConfirmModal — generic confirmation dialog.
 * Used for approve, block, unblock, suspend, reactivate, delete.
 *
 * Props:
 *   isOpen
 *   onClose()
 *   onConfirm()
 *   title
 *   message
 *   confirmLabel  — button text (default "Confirm")
 *   confirmVariant — Button variant (default "primary")
 *   isLoading
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title     = 'Are you sure?',
  message,
  confirmLabel   = 'Confirm',
  confirmVariant = 'primary',
  isLoading = false,
}) => {
  const isDanger = confirmVariant === 'danger'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="px-6 py-5 space-y-4">
        <div
          className={`flex items-start gap-3 p-3.5 rounded-xl border ${
            isDanger ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'
          }`}
        >
          {isDanger ? (
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <p className={`text-sm ${isDanger ? 'text-red-700' : 'text-blue-700'}`}>{message}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
        <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          size="md"
          loading={isLoading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export default ConfirmModal
