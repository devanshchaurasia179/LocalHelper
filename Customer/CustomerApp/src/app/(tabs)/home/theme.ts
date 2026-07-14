// Central design tokens so every component pulls from the same palette/scale.
export const colors = {
  primary: '#12493B',
  primaryDark: '#5A4FE0',
  background: '#FFFFFF',
  surface: '#F7F7FB',
  textPrimary: '#1C1C28',
  textSecondary: '#8E8EA0',
  white: '#FFFFFF',
  star: '#FFB800',
  navInactive: '#B7B7C9',
  chipBackground: 'rgba(255,255,255,0.18)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  greeting: { fontSize: 13, color: colors.textSecondary },
  name: { fontSize: 16, fontWeight: '600' as const, color: colors.textPrimary },
  heading: { fontSize: 24, fontWeight: '700' as const, fontFamily: 'Oswald_700Bold', color: colors.textPrimary, lineHeight: 34 },
  body: { fontSize: 14, color: colors.textPrimary },
  caption: { fontSize: 12, color: colors.textSecondary },
};
