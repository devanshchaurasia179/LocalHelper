import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  createDocumentType,
  updateDocumentType,
  toggleDocumentType,
  deleteDocumentType,
  uploadSampleImage,
  deleteSampleImage,
  updateDisplayOrder,
} from '@/api/documentType.api'

/**
 * useDocumentTypeMutations — centralises all document type management mutations.
 *
 * @param {Object} callbacks — optional { onCreate, onUpdate, onToggle,
 *                             onDelete, onUploadSample, onDeleteSample }
 */
const useDocumentTypeMutations = (callbacks = {}) => {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['documentTypes'] })
  }

  const createMutation = useMutation({
    mutationFn: (data) => createDocumentType(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Document type created')
      invalidate()
      callbacks.onCreate?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to create document type'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateDocumentType(id, data),
    onSuccess: (res) => {
      toast.success(res.message || 'Document type updated')
      invalidate()
      callbacks.onUpdate?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to update document type'),
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => toggleDocumentType(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Status toggled')
      invalidate()
      callbacks.onToggle?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to toggle status'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDocumentType(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Document type deleted')
      invalidate()
      callbacks.onDelete?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to delete document type'),
  })

  const uploadSampleMutation = useMutation({
    mutationFn: ({ id, file }) => uploadSampleImage(id, file),
    onSuccess: (res) => {
      toast.success(res.message || 'Sample image uploaded')
      invalidate()
      callbacks.onUploadSample?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to upload sample image'),
  })

  const deleteSampleMutation = useMutation({
    mutationFn: (id) => deleteSampleImage(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Sample image removed')
      invalidate()
      callbacks.onDeleteSample?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to remove sample image'),
  })

  const orderMutation = useMutation({
    mutationFn: ({ id, displayOrder }) => updateDisplayOrder(id, displayOrder),
    onSuccess: () => {
      invalidate()
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to update order'),
  })

  return {
    invalidate,
    createMutation,
    updateMutation,
    toggleMutation,
    deleteMutation,
    uploadSampleMutation,
    deleteSampleMutation,
    orderMutation,
    isAnyPending:
      createMutation.isPending ||
      updateMutation.isPending ||
      toggleMutation.isPending ||
      deleteMutation.isPending,
  }
}

export default useDocumentTypeMutations
