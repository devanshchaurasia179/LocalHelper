import { useState, useEffect, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import IconPicker from '@/components/ui/IconPicker'

/**
 * SubcategoryForm — modal form for creating / editing a subcategory.
 *
 * Props:
 *   isOpen        — controls modal visibility
 *   onClose       — called when modal is closed
 *   onSubmit      — called with { name, description, icon, image } on save.
 *                   `image` is a File when the admin picked a new one, else undefined.
 *   defaultValues — null for create, subcategory object for edit
 *   categoryName  — parent category name (for display)
 *   isLoading     — disables submit while mutation is in-flight
 */
const SubcategoryForm = ({ isOpen, onClose, onSubmit, defaultValues, categoryName, isLoading }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageCleared, setImageCleared] = useState(false)
  const [errors, setErrors] = useState({})
  const fileInputRef = useRef(null)

  const isEdit = !!defaultValues

  // Sync form state when defaultValues change (edit mode)
  useEffect(() => {
    if (defaultValues) {
      setName(defaultValues.name || '')
      setDescription(defaultValues.description || '')
      setIcon(defaultValues.icon || '')
      setImagePreview(defaultValues.image?.url || '')
    } else {
      setName('')
      setDescription('')
      setIcon('')
      setImagePreview('')
    }
    setImageFile(null)
    setImageCleared(false)
    setErrors({})
  }, [defaultValues, isOpen])

  // Revoke object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'Please select an image file.' }))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: 'Image must be 5 MB or smaller.' }))
      return
    }

    setErrors((prev) => ({ ...prev, image: undefined }))
    setImageFile(file)
    setImageCleared(false)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImageCleared(true)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validate = () => {
    const newErrors = {}
    if (!name.trim()) newErrors.name = 'Subcategory name is required.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
    }

    // Send the raw File — multer handles the upload on the backend.
    if (imageFile) {
      payload.image = imageFile
    } else if (imageCleared) {
      // Explicitly clear the stored image
      payload.image = null
    }

    onSubmit(payload)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Subcategory' : 'New Subcategory'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {categoryName && (
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Parent Category</p>
            <p className="text-sm font-medium text-slate-700">{categoryName}</p>
          </div>
        )}

        <Input
          label="Subcategory Name"
          name="name"
          placeholder="e.g. Electrician, Plumber, AC Repair"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
          autoFocus
        />

        <Input
          label="Description"
          name="description"
          placeholder="Brief description of this subcategory"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <IconPicker
          label="Icon"
          value={icon}
          onChange={(val) => setIcon(val)}
        />

        {/* ── Image upload ── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Image
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Shown to customers in the app. JPG, PNG or WEBP up to 5 MB.
          </p>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Subcategory preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-slate-400">No image</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="subcategory-image-input"
              />
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? 'Change Image' : 'Upload Image'}
              </Button>
              {imagePreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={handleRemoveImage}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          {errors.image && (
            <p className="mt-1.5 text-xs text-red-600">{errors.image}</p>
          )}
        </div>

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

export default SubcategoryForm
