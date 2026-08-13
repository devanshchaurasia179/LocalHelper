import { useState, useEffect } from 'react'
import { MessageSquare, Phone, Clock, IndianRupee } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

/**
 * CommunicationChargesModal
 *
 * Lets admin set:
 *   - Chat charges  : flat ₹ per session
 *   - Call charges  : ₹ amount  per  N  minutes
 *
 * Props:
 *   isOpen        : boolean
 *   onClose       : () => void
 *   onConfirm     : ({ chatCharges, callCharges: { amount, durationMinutes } }) => void
 *   isLoading     : boolean
 *   initialValues : { chatCharges, callCharges: { amount, durationMinutes } }
 *   partnerName   : string
 */
const CommunicationChargesModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  initialValues = {},
  partnerName = 'this partner',
}) => {
  const [chatCharges,      setChatCharges]      = useState('')
  const [callAmount,       setCallAmount]       = useState('')
  const [callDuration,     setCallDuration]     = useState('')
  const [errors,           setErrors]           = useState({})

  // Sync form when modal opens / initialValues change
  useEffect(() => {
    if (isOpen) {
      setChatCharges(initialValues.chatCharges ?? '')
      setCallAmount(initialValues.callCharges?.amount ?? '')
      setCallDuration(initialValues.callCharges?.durationMinutes ?? '')
      setErrors({})
    }
  }, [isOpen, initialValues])

  const validate = () => {
    const e = {}
    const chat = Number(chatCharges)
    const amt  = Number(callAmount)
    const dur  = Number(callDuration)

    if (chatCharges !== '' && (isNaN(chat) || chat < 0))
      e.chatCharges = 'Must be a non-negative number'
    if (callAmount !== '' && (isNaN(amt) || amt < 0))
      e.callAmount = 'Must be a non-negative number'
    if (callDuration !== '' && (isNaN(dur) || dur < 1 || !Number.isInteger(dur)))
      e.callDuration = 'Must be a whole number ≥ 1'
    if ((callAmount !== '' && callDuration === '') || (callAmount === '' && callDuration !== ''))
      e.callPair = 'Both call amount and duration must be set together'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    const payload = {}
    if (chatCharges !== '') payload.chatCharges = Number(chatCharges)
    if (callAmount  !== '' && callDuration !== '') {
      payload.callCharges = {
        amount:          Number(callAmount),
        durationMinutes: Number(callDuration),
      }
    }

    if (Object.keys(payload).length === 0) {
      setErrors({ general: 'Enter at least one value to update.' })
      return
    }

    onConfirm(payload)
  }

  const handleClose = () => {
    if (!isLoading) onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Set Communication Charges"
      size="sm"
    >
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-slate-500">
            Configure chat and call pricing for{' '}
            <span className="font-medium text-slate-700">{partnerName}</span>.
            Leave a field blank to keep its current value.
          </p>

          {/* ── Chat charge ─────────────────────────────── */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-slate-700">Chat</span>
              <span className="text-xs text-slate-400 ml-auto">flat rate per session</span>
            </div>
            <Input
              name="chatCharges"
              type="number"
              min="0"
              step="0.5"
              placeholder="e.g. 15"
              value={chatCharges}
              onChange={(e) => setChatCharges(e.target.value)}
              leftIcon={<IndianRupee className="w-3.5 h-3.5" />}
              error={errors.chatCharges}
              disabled={isLoading}
              aria-label="Chat charge amount"
            />
          </div>

          {/* ── Call charge ─────────────────────────────── */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-700">Call</span>
              <span className="text-xs text-slate-400 ml-auto">₹ per N minutes</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                name="callAmount"
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 20"
                value={callAmount}
                onChange={(e) => setCallAmount(e.target.value)}
                leftIcon={<IndianRupee className="w-3.5 h-3.5" />}
                label="Amount"
                error={errors.callAmount}
                disabled={isLoading}
                aria-label="Call charge amount"
              />
              <Input
                name="callDuration"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 10"
                value={callDuration}
                onChange={(e) => setCallDuration(e.target.value)}
                leftIcon={<Clock className="w-3.5 h-3.5" />}
                label="Minutes"
                error={errors.callDuration}
                disabled={isLoading}
                aria-label="Call duration minutes"
              />
            </div>
            {errors.callPair && (
              <p className="text-xs text-red-600" role="alert">{errors.callPair}</p>
            )}
            {callAmount && callDuration && !errors.callAmount && !errors.callDuration && !errors.callPair && (
              <p className="text-xs text-emerald-600 font-medium">
                ₹{callAmount} per {callDuration} min
              </p>
            )}
          </div>

          {errors.general && (
            <p className="text-xs text-red-600 text-center" role="alert">{errors.general}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isLoading}
          >
            Save Charges
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CommunicationChargesModal
