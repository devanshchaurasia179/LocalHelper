// ─── Dashboard design tokens ──────────────────────────────────────────────────
// All colours, spacing, radii, and type scale for the dashboard live here.
// Change values once → entire dashboard restyled.

export const DashColors = {
  // Brand / accent
  primary: '#7C3AED',        // purple-600
  primaryLight: '#8B5CF6',   // purple-500
  primaryDark: '#5B21B6',    // purple-800

  // Backgrounds
  background: '#F8F7FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F0FA',

  // Text
  textPrimary: '#1A1033',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  // Functional
  star: '#FBBF24',           // amber-400
  border: '#E9E5F5',
  shadow: 'rgba(124,58,237,0.12)',

  // Bottom-nav
  navBackground: '#FFFFFF',
  navActive: '#7C3AED',
  navInactive: '#9CA3AF',
} as const;

export const DashSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const DashRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const DashType = {
  // font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
} as const;

/** Height of the floating bottom nav bar */
export const NAV_HEIGHT = 64;
/** Extra bottom padding so content is never hidden behind the nav */
export const NAV_INSET = NAV_HEIGHT + 12;
