import { useState } from 'react'
import { cn } from '@/utils/cn'
import { getInitials } from '@/utils/formatters'

/**
 * Avatar — shows a profile image with graceful fallback to initials.
 * If the image fails to load, we render a colored circle with the user's initials.
 *
 * size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 */
const SIZES = {
  xs: 'w-6  h-6  text-xs',
  sm: 'w-8  h-8  text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

// Deterministic color based on name so the same person always gets the same color
const COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-rose-500',
]

const getColor = (name = '') => {
  const index = name.charCodeAt(0) % COLORS.length
  return COLORS[index] || COLORS[0]
}

const Avatar = ({ src, name = '', size = 'md', className }) => {
  const [imgError, setImgError] = useState(false)
  const initials = getInitials(name)
  const colorClass = getColor(name)

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        onError={() => setImgError(true)}
        className={cn(
          'rounded-full object-cover flex-shrink-0',
          SIZES[size] || SIZES.md,
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white',
        SIZES[size] || SIZES.md,
        colorClass,
        className
      )}
      aria-label={name}
      role="img"
    >
      {initials}
    </div>
  )
}

export default Avatar
