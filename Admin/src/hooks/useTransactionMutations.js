import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { processPayout, adjustBalance } from '@/api/transaction.api'

/**
 * useTransactionMutations — handles all admin transaction write operations.
 *
 * @param {string} partnerId       — used to invalidate the transactions query
 * @param {Object} callbacks
 *   onProcessSuccess()            — called after a payout is processed
 *   onAdjustSuccess()             — called after a balance adjustment succeeds
 */
const useTransactionMutations = (partnerId, callbacks = {}) => {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions', partnerId] })
    // Also invalidate the partner detail so wallet balance refreshes
    queryClient.invalidateQueries({ queryKey: ['partner', partnerId] })
  }

  // ── Process payout (complete | failed) ──────────────────────────
  const processPayoutMutation = useMutation({
    mutationFn: ({ transactionId, status, failureReason }) =>
      processPayout(transactionId, { status, failureReason }),
    onSuccess: (data, variables) => {
      const label = variables.status === 'completed' ? 'Payout completed' : 'Payout marked as failed'
      toast.success(label)
      invalidate()
      // Also invalidate the global payout queue
      queryClient.invalidateQueries({ queryKey: ['payout-queue'] })
      callbacks.onProcessSuccess?.()
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to process payout.')
    },
  })

  // ── Manual balance adjustment ────────────────────────────────────
  const adjustBalanceMutation = useMutation({
    mutationFn: ({ amount, direction, description }) =>
      adjustBalance(partnerId, { amount, direction, description }),
    onSuccess: (data) => {
      toast.success(data.message || 'Balance adjusted successfully.')
      invalidate()
      callbacks.onAdjustSuccess?.()
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to adjust balance.')
    },
  })

  return {
    processPayoutMutation,
    adjustBalanceMutation,
    isAnyPending:
      processPayoutMutation.isPending || adjustBalanceMutation.isPending,
  }
}

export default useTransactionMutations
