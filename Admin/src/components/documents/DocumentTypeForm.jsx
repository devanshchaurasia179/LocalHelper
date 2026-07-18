import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Info } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'

/**
 * DocumentTypeForm — modal form for create / edit document type.
 *
 * Props:
 *   isOpen
 *   onClose()
 *   onSubmit(data)   — called with validated form data
 *   defaultValues    — if editing, pass the existing document type
 *   isLoading
 */

const FILE_TYPE_OPTIONS = [
  { label: 'JPEG',    value: 'image/jpeg' },
  { label: 'PNG',     value: 'image/png' },
  { label: 'WebP',    value: 'image/webp' },
  { label: 'PDF',     value: 'application/pdf' },
  { label: 'HEIC',    value: 'image/heic' },
]

const schema = z.object({
  label: z.string().min(1, 'Label is required').max(100),
  key: z
    .string()
    .min(1, 'Key is required')
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, digits, and underscores'),
  description:        z.string().max(500).optional(),
  helpText:           z.string().max(500).optional(),
  uploadInstructions: z.string().max(500).optional(),
  icon:               z.string().max(60).optional(),
  displayOrder:       z.coerce.number().int().min(0).max(9999).default(0),
  maxFileSizeMB:      z.coerce.number().min(0.1).max(50).default(5),
  isRequired:         z.boolean().default(true),
  isMultiPage:        z.boolean().default(false),
  hasNumberField:     z.boolean().default(false),
  numberFieldLabel:   z.string().max(60).optional(),
  numberFieldPlaceholder: z.string().max(100).optional(),
  numberFieldValidationRegex: z.string().max(200).optional(),
  numberFieldValidationMessage: z.string().max(200).optional(),
  acceptedFileTypes:  z.array(z.string()).min(1, 'Select at least one file type'),
})

const DEFAULTS = {
  label: '',
  key: '',
  description: '',
  helpText: '',
  uploadInstructions: '',
  icon: '',
  displayOrder: 0,
  maxFileSizeMB: 5,
  isRequired: true,
  isMultiPage: false,
  hasNumberField: false,
  numberFieldLabel: '',
  numberFieldPlaceholder: '',
  numberFieldValidationRegex: '',
  numberFieldValidationMessage: '',
  acceptedFileTypes: ['image/jpeg', 'image/png', 'image/webp'],
}

const DocumentTypeForm = ({
  isOpen,
  onClose,
  onSubmit,
  defaultValues,
  isLoading = false,
}) => {
  const isEditing = !!defaultValues

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  })

  const hasNumberField = watch('hasNumberField')

  // Populate form when editing
  useEffect(() => {
    if (isOpen) {
      if (defaultValues) {
        reset({
          ...DEFAULTS,
          ...defaultValues,
          displayOrder:  defaultValues.displayOrder  ?? 0,
          maxFileSizeMB: defaultValues.maxFileSizeMB ?? 5,
        })
      } else {
        reset(DEFAULTS)
      }
    }
  }, [isOpen, defaultValues, reset])

  const handleClose = () => {
    reset(DEFAULTS)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Document Type' : 'Create Document Type'}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* ── Basic info ─────────────────────────────────────────── */}
          <Section title="Basic Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                {...register('label')}
                label="Label"
                required
                placeholder="e.g. Aadhaar Card"
                error={errors.label?.message}
                helperText="Display name shown to partners"
              />
              <Input
                {...register('key')}
                label="Unique Key"
                required
                placeholder="e.g. aadhaar_card"
                disabled={isEditing} // key is immutable after creation
                error={errors.key?.message}
                helperText={isEditing ? 'Key cannot be changed after creation' : 'Lowercase with underscores only'}
              />
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={2}
                  placeholder="Brief description of what this document is..."
                  className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 px-3.5 py-2.5 resize-none hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Help Text
                </label>
                <textarea
                  {...register('helpText')}
                  rows={2}
                  placeholder="Shown below the upload field to guide partners..."
                  className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 px-3.5 py-2.5 resize-none hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Upload Instructions
                </label>
                <textarea
                  {...register('uploadInstructions')}
                  rows={2}
                  placeholder="Step-by-step instructions for uploading this document..."
                  className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 px-3.5 py-2.5 resize-none hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>
          </Section>

          {/* ── Configuration ─────────────────────────────────────── */}
          <Section title="Configuration">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                {...register('icon')}
                label="Icon Name"
                placeholder="e.g. shield-check"
                error={errors.icon?.message}
                helperText="Lucide icon name (kebab-case)"
              />
              <Input
                {...register('displayOrder')}
                label="Display Order"
                type="number"
                min={0}
                max={9999}
                placeholder="0"
                error={errors.displayOrder?.message}
                helperText="Lower numbers appear first"
              />
              <Input
                {...register('maxFileSizeMB')}
                label="Max File Size (MB)"
                type="number"
                step="0.1"
                min={0.1}
                max={50}
                placeholder="5"
                error={errors.maxFileSizeMB?.message}
              />
            </div>

            {/* Toggles */}
            <div className="mt-4 space-y-3">
              <Toggle name="isRequired" register={register} label="Required Document" description="Partners must upload this to submit for verification" />
              <Toggle name="isMultiPage" register={register} label="Multi-Page (Front / Back)" description="Partner uploads two sides (e.g., Aadhaar Card)" />
              <Toggle name="hasNumberField" register={register} label="Has Number Field" description="Partner must also enter a document number (e.g., PAN, Aadhaar number)" />
            </div>
          </Section>

          {/* ── Number field config — only shown when hasNumberField is on ── */}
          {hasNumberField && (
            <Section title="Number Field Settings">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  {...register('numberFieldLabel')}
                  label="Field Label"
                  placeholder="e.g. Aadhaar Number"
                  error={errors.numberFieldLabel?.message}
                />
                <Input
                  {...register('numberFieldPlaceholder')}
                  label="Placeholder"
                  placeholder="e.g. 1234 5678 9012"
                  error={errors.numberFieldPlaceholder?.message}
                />
                <Input
                  {...register('numberFieldValidationRegex')}
                  label="Validation Regex"
                  placeholder="e.g. ^\d{12}$"
                  error={errors.numberFieldValidationRegex?.message}
                  helperText="Leave empty to skip validation"
                />
                <Input
                  {...register('numberFieldValidationMessage')}
                  label="Validation Error Message"
                  placeholder="e.g. Aadhaar must be 12 digits"
                  error={errors.numberFieldValidationMessage?.message}
                />
              </div>
            </Section>
          )}

          {/* ── Accepted file types ────────────────────────────────── */}
          <Section title="Accepted File Types">
            {errors.acceptedFileTypes && (
              <p className="text-xs text-red-600 mb-2">{errors.acceptedFileTypes.message}</p>
            )}
            <Controller
              name="acceptedFileTypes"
              control={control}
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {FILE_TYPE_OPTIONS.map((opt) => {
                    const checked = (field.value || []).includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const next = checked
                            ? field.value.filter((v) => v !== opt.value)
                            : [...(field.value || []), opt.value]
                          field.onChange(next)
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                          checked
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:text-primary-600'
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}
            />
            <p className="text-xs text-slate-400 mt-2">
              Selected: {FILE_TYPE_OPTIONS.filter((o) => (watch('acceptedFileTypes') || []).includes(o.value)).map((o) => o.label).join(', ') || 'None'}
            </p>
          </Section>

          {/* Info note for editing */}
          {isEditing && (
            <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 rounded-xl border border-blue-100">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Changes take effect immediately. The partner app will use the updated configuration on the next document upload.
                The <strong>key</strong> field is locked — use disable + recreate if you need to change it.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <Button type="button" variant="secondary" size="md" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Document Type'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Small helpers ────────────────────────────────────────────────────

const Section = ({ title, children }) => (
  <div>
    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
    {children}
  </div>
)

const Toggle = ({ name, register, label, description }) => (
  <label className="flex items-start gap-3 cursor-pointer group select-none">
    <div className="relative mt-0.5 flex-shrink-0">
      <input
        type="checkbox"
        className="peer sr-only"
        {...register(name)}
      />
      {/* Track */}
      <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-primary-600 transition-colors duration-200" />
      {/* Thumb */}
      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 peer-checked:translate-x-4" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-700 leading-tight">{label}</p>
      {description && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>}
    </div>
  </label>
)

export default DocumentTypeForm
