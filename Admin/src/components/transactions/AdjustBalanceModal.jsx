import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatters'
import { cn } from '@/utils/cn'

const schema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be a positive number'),
  direction: z.enum(['credit', 'debit'], { required_error: 'Direction is required' }),
  description: z
    .string()
    .min(1, 'Description is required')
    .min(5, 'Please provide at least 5 characters')
    .max(200, 'Keep description under 200 characters'),
})

/**
 * AdjustBalanceModal — admin form to credit or debit a partner's wallet.
 *
 * Props:
 *   isOpen
 *   partnerName      — shown in the heading
 *   walletBalance    — current balance for context
 *   onClose()
 *   onConfirm({ amount, direction, description })
 *   isLoading
 */
const AdjustBalanceModal = ({
  isOpen,
  partnerName,
  walletBalance,
  onClose,
  onConfirm,
  isLoading,
}) => {
  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { direction: 'credit', amount: '', description: '' },
  })

  const direction   = watch('direction')
  const amountRaw   = watch('amount')
  const amountNum   = parseFloat(amountRaw) || 0
  const newBalance  = direction === 'credit'
    ? (walletBalance ?? 0) + amountNum
    : (walletBalance ?? 0) - amountNum

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) reset({ direction: 'credit', amount: '', description: '' })
  }, [isOpen, reset])

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = (data) => {
    onConfirm({
      amount:      Number(data.amount),
      direction:   data.direction,
      description: data.description.trim(),
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Adjust Balance" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-6 py-5 space-y-5">

          {/* Context */}
          {partnerName && (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Partner</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{partnerName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Current Balance</p>
                <p className="text-sm font-bold text-slateald-800 mt-0.5">
                  {formatCurrency(walletBalance ?? 0)}
                </p>
              </div>
            </div>
          )}

          {/* Direction selector */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Direction</p>
            <Controller
              name="direction"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => field.onChange('credit')}
                    className={cn(
                      'flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all',
                      field.value === 'credit'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <ArrowDownLeft className={cn('w-5 h-5', field.value === 'credit' ? 'text-emerald-600' : 'text-slate-400')} />
                    <div className="text-left">
                      <p className={cn('text-sm font-semibold', field.value === 'credit' ? 'text-emerald-700' : 'text-slate-700')}>
                        Credit
                      </p>
                      <p className="text-xs text-slate-400">Add to balance</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange('debit')}
                    className={cn(
                      'flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all',
                      field.value === 'debit'
                        ? 'border-red-400 bg-red-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <ArrowUpRight className={cn('w-5 h-5', field.value === 'debit' ? 'text-red-500' : 'text-slate-400')} />
                    <div className="text-left">
                      <p className={cn('text-sm font-semibold', field.value === 'debit' ? 'text-red-600' : 'text-slate-700')}>
                        Debit
                      </p>
                      <p className="text-xs text-slate-400">Deduct from balance</p>
                    </div>
                  </button>
                </div>
              )}
            />
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="adjust-amount" className="text-sm font-medium text-slate-700">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm pointer-events-none">
                ₹
              </span>
              <input
                id="adjust-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className={cn(
                  'w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder:text-slate-400',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                  errors.amount ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
                )}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'amount-error' : undefined}
                {...register('amount')}
              />
            </div>
            {errors.amount && (
              <p id="amount-error" className="text-xs text-red-600" role="alert">
                {errors.amount.message}
              </p>
            )}
            {/* Preview */}
            {amountNum > 0 && (
              <div className="flex items-center gap-2 mt-1 p-2.5 bg-slate-50 rounded-lg">
                <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <p className="text-xs text-slate-500">
                  New balance after adjustment:{' '}
                  <span className={cn('font-semibold', newBalance < 0 ? 'text-red-600' : 'text-slate-800')}>
                    {formatCurrency(newBalance)}
                  </span>
                  {newBalance < 0 && (
                    <span className="text-red-500 ml-1">(insufficient balance)</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="adjust-description" className="text-sm font-medium text-slate-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="adjust-description"
              rows={3}
              placeholder="e.g. Refund for cancelled booking #12345"
              className={cn(
                'w-full rounded-xl border text-sm text-slate-800 placeholder:text-slate-400',
                'px-3.5 py-2.5 resize-none hover:border-slate-300',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                errors.description ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
              )}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'desc-error' : undefined}
              {...register('description')}
            />
            {errors.description && (
              <p id="desc-error" className="text-xs text-red-600" role="alert">
                {errors.description.message}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <Button type="button" variant="secondary" size="md" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={direction === 'debit' ? 'danger' : 'primary'}
            size="md"
            loading={isLoading}
          >
            {direction === 'credit' ? 'Credit Balance' : 'Debit Balance'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default AdjustBalanceModal
