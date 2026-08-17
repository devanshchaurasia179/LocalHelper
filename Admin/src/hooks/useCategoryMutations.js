import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
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

  // ── Subcategory mutations ──────────────────────────────────────────

  const addSubcategoryMutation = useMutation({
    mutationFn: ({ categoryId, data }) => addSubcategory(categoryId, data),
    onSuccess: (res) => {
      toast.success(res.message || 'Subcategory added')
      invalidate()
      callbacks.onAddSubcategory?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to add subcategory'),
  })

  const updateSubcategoryMutation = useMutation({
    mutationFn: ({ categoryId, subId, data }) => updateSubcategory(categoryId, subId, data),
    onSuccess: (res) => {
      toast.success(res.message || 'Subcategory updated')
      invalidate()
      callbacks.onUpdateSubcategory?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to update subcategory'),
  })

  const deleteSubcategoryMutation = useMutation({
    mutationFn: ({ categoryId, subId }) => deleteSubcategory(categoryId, subId),
    onSuccess: (res) => {
      toast.success(res.message || 'Subcategory deleted')
      invalidate()
      callbacks.onDeleteSubcategory?.(res)
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to delete subcategory'),
  })

  return {
    invalidate,
    createMutation,
    updateMutation,
    toggleMutation,
    deleteMutation,
    addSubcategoryMutation,
    updateSubcategoryMutation,
    deleteSubcategoryMutation,
    isAnyPending:
      createMutation.isPending ||
      updateMutation.isPending ||
      toggleMutation.isPending ||
      deleteMutation.isPending ||
      addSubcategoryMutation.isPending ||
      updateSubcategoryMutation.isPending ||
      deleteSubcategoryMutation.isPending,
  }
}

export default useCategoryMutations
