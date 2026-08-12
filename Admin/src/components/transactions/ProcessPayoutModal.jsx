import { useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, BanknoteIcon } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { formatCurrency, formatDateTime } from '@/utils/formatters'

/**
 * ProcessPayoutModal — lets admin mark a payout as "completed" or "failed".
 * If failed, a failure reason is required.
 *
 * Props:
 *   isOpen
 *   transaction    — the payout transaction object
 *   onClose()
 *   onConfirm({ status, failureReason })
 *   isLoading
 */
const ProcessPayoutModal = ({ isOpen, transaction: tx, onClose, onConfirm, isLoading }) => {
  const [action,        setAction]        = useState(null)   // 'completed' | 'failed'
  const [failureReason, setFailureReason] = useState('')
  const [reasonError,   setReasonError]   = useState('')

  const handleClose = () => {
    setAction(null)
    setFailureReason('')
    setReasonError('')
    onClose()
  }

  const handleConfirm = () => {
    if (!action) return
    if (action === 'failed') {
      if (!failureReason.trim()) {
        setReasonError('A failure reason is required.')
        return
      }
      if (failureReason.trim().length < 5) {
        setReasonError('Please provide at least 5 characters.')
        return
      }
    }
    onConfirm({ status: action, failureReason: failureReason.trim() || undefined })
  }

  if (!tx) return null

  const method    = tx.payoutDetails?.method
  const isBank    = method === 'bank'
  const isUpi     = method === 'upi'

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Process Payout" size="md">
      <div className="px-6 py-5 space-y-5">

        {/* Payout summary */}
        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
            <BanknoteIcon className="w-5 h-5 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-slate-800 tabular-nums">
              {formatCurrency(tx.amount)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Requested {formatDateTime(tx.createdAt)}
            </p>
            {isBank && (
              <p className="text-xs text-slate-500 mt-1">
                Bank transfer · ****{tx.payoutDetails.accountNumber}
                {tx.payoutDetails.bankName && ` · ${tx.payoutDetails.bankName}`}
              </p>
            )}
            {isUpi && (
              <p className="text-xs text-slate-500 mt-1">
                UPI · {tx.payoutDetails.upiId}
              </p>
            )}
            {tx.payoutDetails?.accountHolderName && (
              <p className="text-xs text-slate-400">{tx.payoutDetails.accountHolderName}</p>
            )}
          </div>
        </div>

        {/* Action choice */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">Mark payout as:</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setAction('completed'); setReasonError('') }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left
                ${action === 'completed'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
            >
              <CheckCircle2 className={`w-6 h-6 ${action === 'completed' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div>
                <p className={`text-sm font-semibold ${action === 'completed' ? 'text-emerald-700' : 'text-slate-700'}`}>
                  Completed
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Transfer was successful</p>
              </div>
            </button>

            <button
              onClick={() => setAction('failed')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left
                ${action === 'failed'
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
            >
              <XCircle className={`w-6 h-6 ${action === 'failed' ? 'text-red-500' : 'text-slate-400'}`} />
              <div>
                <p className={`text-sm font-semibold ${action === 'failed' ? 'text-red-600' : 'text-slate-700'}`}>
                  Failed
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Amount will be refunded</p>
              </div>
            </button>
          </div>
        </div>

        {/* Failure reason (shown only when failed is selected) */}
        {action === 'failed' && (
          <div>
            <label htmlFor="failure-reason" className="text-sm font-medium text-slate-700 mb-1.5 block">
              Failure reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="failure-reason"
              rows={3}
              placeholder="e.g. Invalid account number, bank rejected the transfer."
              className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400
                px-3.5 py-2.5 resize-none hover:border-slate-300 focus:outline-none focus:ring-2
                focus:ring-primary-500 focus:border-transparent transition-colors"
              value={failureReason}
              onChange={(e) => { setFailureReason(e.target.value); setReasonError('') }}
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? 'failure-reason-error' : undefined}
            />
            {reasonError && (
              <p id="failure-reason-error" className="text-xs text-red-600 mt-1" role="alert">
                {reasonError}
              </p>
            )}
            <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-700">
                Marking as failed will automatically reverse the wallet deduction and restore the partner's balance.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
        <Button type="button" variant="secondary" size="md" onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={action === 'failed' ? 'danger' : 'primary'}
          size="md"
          disabled={!action}
          loading={isLoading}
          onClick={handleConfirm}
        >
          {action === 'completed' ? 'Mark Completed' : action === 'failed' ? 'Mark Failed' : 'Select action'}
        </Button>
      </div>
    </Modal>
  )
}

export default ProcessPayoutModal
