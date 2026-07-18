import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  approveDocument,
  rejectDocument,
  forceApproveVerification,
  forceRejectVerification,
} from '@/api/verification.api'

/**
 * useVerificationMutations — centralises all document-level and session-level
 * verification mutations for the VerificationDetailPage.
 *
 * @param {string} partnerId  — the partner's MongoDB _id
 * @param {Object} callbacks  — optional { onDocumentApprove, onDocumentReject,
 *                              onForceApprove, onForceReject }
 *                              each called with the API response on success
 */
const useVerificationMutations = (partnerId, callbacks = {}) => {
  const queryClient = useQueryClient()

  // Invalidate every query that may display stale verification state
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['verificationDetail', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['pendingVerifications'] })
    queryClient.invalidateQueries({ queryKey: ['partner', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partners'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['latestPending'] })
  }

  // ── Document-level approve ──────────────────────────────────────────
  const approveDocumentMutation = useMutation({
    mutationFn: ({ documentId, note }) => approveDocument(partnerId, documentId, note),
    onSuccess: (res) => {
      const msg = res.autoPromoted
        ? `Document approved. Partner is now fully verified! 🎉`
        : res.message || 'Document approved'
      toast.success(msg)
      invalidate()
      callbacks.onDocumentApprove?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to approve document'),
  })

  // ── Document-level reject ───────────────────────────────────────────
  const rejectDocumentMutation = useMutation({
    mutationFn: ({ documentId, reason }) => rejectDocument(partnerId, documentId, reason),
    onSuccess: (res) => {
      toast.success(res.message || 'Document rejected')
      invalidate()
      callbacks.onDocumentReject?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to reject document'),
  })

  // ── Force-approve entire verification ──────────────────────────────
  const forceApproveMutation = useMutation({
    mutationFn: (note) => forceApproveVerification(partnerId, note),
    onSuccess: (res) => {
      toast.success(res.message || 'Partner verification approved')
      invalidate()
      callbacks.onForceApprove?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to approve verification'),
  })

  // ── Force-reject entire verification ───────────────────────────────
  const forceRejectMutation = useMutation({
    mutationFn: (reason) => forceRejectVerification(partnerId, reason),
    onSuccess: (res) => {
      toast.success(res.message || 'Partner verification rejected')
      invalidate()
      callbacks.onForceReject?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to reject verification'),
  })

  return {
    invalidate,
    approveDocumentMutation,
    rejectDocumentMutation,
    forceApproveMutation,
    forceRejectMutation,
    isAnyPending:
      approveDocumentMutation.isPending ||
      rejectDocumentMutation.isPending ||
      forceApproveMutation.isPending ||
      forceRejectMutation.isPending,
  }
}

export default useVerificationMutations
