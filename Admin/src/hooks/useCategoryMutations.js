import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
} from '@/api/category.api'

/**
 * useCategoryMutations — centralises all category management mutations.
 *
 * @param {Object} callbacks — optional { onCreate, onUpdate, onToggle, onDelete }
 */
const useCategoryMutations = (callbacks = {}) => {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  const createMutation = useMutation({
    mutationFn: (data) => createCategory(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Category created')
      invalidate()
      callbacks.onCreate?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to create category'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCategory(id, data),
    onSuccess: (res) => {
      toast.success(res.message || 'Category updated')
      invalidate()
      callbacks.onUpdate?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to update category'),
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => toggleCategory(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Status toggled')
      invalidate()
      callbacks.onToggle?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to toggle status'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Category deleted')
      invalidate()
      callbacks.onDelete?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to delete category'),
  })

  return {
    invalidate,
    createMutation,
    updateMutation,
    toggleMutation,
    deleteMutation,
    isAnyPending:
      createMutation.isPending ||
      updateMutation.isPending ||
      toggleMutation.isPending ||
      deleteMutation.isPending,
  }
}

export default useCategoryMutations
