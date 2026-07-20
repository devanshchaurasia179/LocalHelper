import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import IconPicker from '@/components/ui/IconPicker'

/**
 * CategoryForm — modal form for creating / editing a category.
 *
 * Props:
 *   isOpen        — controls modal visibility
 *   onClose       — called when modal is closed
 *   onSubmit      — called with { name, description, icon } on save
 *   defaultValues — null for create, category object for edit
 *   isLoading     — disables submit while mutation is in-flight
 */
const CategoryForm = ({ isOpen, onClose, onSubmit, defaultValues, isLoading }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [errors, setErrors] = useState({})

  const isEdit = !!defaultValues

  // Sync form state when defaultValues change (edit mode)
  useEffect(() => {
    if (defaultValues) {
      setName(defaultValues.name || '')
      setDescription(defaultValues.description || '')
      setIcon(defaultValues.icon || '')
    } else {
      setName('')
      setDescription('')
      setIcon('')
    }
    setErrors({})
  }, [defaultValues, isOpen])

  const validate = () => {
    const newErrors = {}
    if (!name.trim()) newErrors.name = 'Category name is required.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Category' : 'New Category'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <Input
          label="Category Name"
          name="name"
          placeholder="e.g. Plumbing, Electrical, Cleaning"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
          autoFocus
        />

        <Input
          label="Description"
          name="description"
          placeholder="Brief description of this service category"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <IconPicker
          label="Icon"
          value={icon}
          onChange={(val) => setIcon(val)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="md" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" size="md" type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CategoryForm
