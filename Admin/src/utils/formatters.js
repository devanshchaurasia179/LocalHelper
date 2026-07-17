/**
 * Shared formatting utilities — used across tables, badges, cards.
 * Keeping these in one file means a date format change propagates everywhere.
 */

/** Format a date string as "18 Jul 2026" */
export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

/** Format a date string as "18 Jul 2026, 10:35 AM" */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

/** Format a number as Indian currency — ₹1,23,456 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Compact large numbers — 1234 → "1.2K", 1234567 → "1.2M" */
export const formatCompact = (num) => {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num)
}

/** Capitalize first letter of each word */
export const titleCase = (str) => {
  if (!str) return ''
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/** Return initials from a full name — "Rahul Sharma" → "RS" */
export const getInitials = (name) => {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

/**
 * Map verificationStatus to a Tailwind color variant string.
 * Used by the StatusBadge component.
 */
export const getVerificationVariant = (status) => {
  const map = {
    Pending:      'warning',
    'Under Review': 'info',
    Approved:     'success',
    Rejected:     'danger',
  }
  return map[status] || 'default'
}

/**
 * Map accountStatus to a Tailwind color variant string.
 */
export const getAccountVariant = (status) => {
  const map = {
    Active:    'success',
    Blocked:   'danger',
    Suspended: 'warning',
  }
  return map[status] || 'default'
}
