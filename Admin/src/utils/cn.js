import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * cn — class name utility.
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 *
 * Usage:
 *   cn('px-4 py-2', isActive && 'bg-primary-600', 'text-white')
 *   // → 'px-4 py-2 bg-primary-600 text-white' (when isActive = true)
 */
export const cn = (...inputs) => twMerge(clsx(inputs))
