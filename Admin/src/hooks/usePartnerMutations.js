import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  approvePartner,
  rejectPartner,
  blockPartner,
  unblockPartner,
  suspendPartner,
  reactivatePartner,
  deletePartner,
} from '@/api/partner.api'

/**
 * usePartnerMutations — centralises all partner management mutations.
 *
 * Returns each mutation object plus an `invalidate` helper so components
 * don't repeat query key lists.
 *
 * @param {string} partnerId  — the partner's MongoDB _id
 * @param {Object} callbacks  — optional { onApprove, onReject, onBlock, ... }
 *                              each called with the API response on success
 */
const usePartnerMutations = (partnerId, callbacks = {}) => {
  const queryClient = useQueryClient()

  // Invalidate every query that might display stale partner data.
  // Calling this after any mutation keeps dashboard, list, and detail
  // views all in sync without manual coordination.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['partner', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partners'] })
    queryClient.invalidateQueries({ queryKey: ['pendingPartners'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['latestPartners'] })
    queryClient.invalidateQueries({ queryKey: ['latestPending'] })
  }

  const approveMutation = useMutation({
    mutationFn: () => approvePartner(partnerId),
    onSuccess: (res) => {
      toast.success(res.message || 'Partner approved successfully')
      invalidate()
      callbacks.onApprove?.(res)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Approval failed'),
  })

  const rejectMutation = useMutation({
    mutationFn: (reason) => rejectPartner(partnerId, reason),
    onSuccess: (res) => {
      toast.success(res.message || 'Partner rejected')
      invalidate()
      callbacks.onReject?.(res)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Rejection failed'),
  })

  const blockMutation = useMutation({
    mutationFn: (reason) => blockPartner(partnerId, reason),
    onSuccess: (res) => {
      toast.success(res.message || 'Partner blocked')
      invalidate()
      callbacks.onBlock?.(res)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Block failed'),
  })

  const unblockMutation = useMutation({
    mutationFn: () => unblockPartner(partnerId),
    onSuccess: (res) => {
      toast.success(res.message || 'Partner unblocked')
      invalidate()
      callbacks.onUnblock?.(res)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Unblock failed'),
  })

  const suspendMutation = useMutation({
    mutationFn: (reason) => suspendPartner(partnerId, reason),
    onSuccess: (res) => {
      toast.success(res.message || 'Partner suspended')
      invalidate()
      callbacks.onSuspend?.(res)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Suspend failed'),
  })

  const reactivateMutation = useMutation({
    mutationFn: () => reactivatePartner(partnerId),
    onSuccess: (res) => {
      toast.success(res.message || 'Partner reactivated')
      invalidate()
      callbacks.onReactivate?.(res)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Reactivate failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deletePartner(partnerId),
    onSuccess: (res) => {
      toast.success(res.message || 'Partner deleted')
      invalidate()
      callbacks.onDelete?.(res)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  })

  return {
    invalidate,
    approveMutation,
    rejectMutation,
    blockMutation,
    unblockMutation,
    suspendMutation,
    reactivateMutation,
    deleteMutation,
    // Convenience: true if any mutation is in-flight
    isAnyPending:
      approveMutation.isPending  ||
      rejectMutation.isPending   ||
      blockMutation.isPending    ||
      unblockMutation.isPending  ||
      suspendMutation.isPending  ||
      reactivateMutation.isPending ||
      deleteMutation.isPending,
  }
}

export default usePartnerMutations
