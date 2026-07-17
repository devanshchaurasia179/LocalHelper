// Central design tokens so every component pulls from the same palette/scale.
export const colors = {
  primary: '#16493c',
  primaryDark: '#0d2e26',
  background: '#FFFFFF',
  surface: '#F7F7FB',
  surfaceAlt: '#F5F5F5',
  textPrimary: '#1C1C28',
  textSecondary: '#626262ff',
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

// ─── Font families ─────────────────────────────────────────────────────────────
// Jost        → body / normal text (user's favourite)
// Oswald      → numeric stats, price figures, bold labels
// Plus Jakarta Sans → names, secondary headings, chips, display
// Archivo Black → promo impact numbers / big discount %
export const fonts = {
  jostLight:      'Jost_300Light',
  jostRegular:    'Jost_400Regular',
  jostMedium:     'Jost_500Medium',
  jostSemiBold:   'Jost_600SemiBold',
  oswaldRegular:  'Oswald_400Regular',
  oswaldSemiBold: 'Oswald_600SemiBold',
  oswaldBold:     'Oswald_700Bold',
  archivoBlack:   'ArchivoBlack_400Regular',
  jakartaRegular: 'PlusJakartaSans_400Regular',
  jakartaMedium:  'PlusJakartaSans_500Medium',
  jakartaSemiBold:'PlusJakartaSans_600SemiBold',
  jakartaBold:    'PlusJakartaSans_700Bold',
};

export const typography = {
  // Hero section — Jost light greeting, Cinzel bold tagline
  greeting:       { fontFamily: fonts.jostRegular,    fontSize: 13, color: colors.white },
  heroTagline:    { fontFamily: fonts.oswaldBold,      fontSize: 32, color: colors.white, lineHeight: 40, letterSpacing: 0.5 },

  // Section headings — Oswald for crisp impact
  heading:        { fontFamily: fonts.oswaldSemiBold, fontSize: 22, color: colors.textPrimary, lineHeight: 30, letterSpacing: 0.3 },
  subheading:     { fontFamily: fonts.jakartaSemiBold,fontSize: 14, color: colors.textPrimary },

  // Names & labels — Plus Jakarta Sans
  name:           { fontFamily: fonts.jakartaSemiBold,fontSize: 16, color: colors.textPrimary },
  label:          { fontFamily: fonts.jakartaMedium,  fontSize: 12, color: colors.textSecondary },

  // Body & captions — Jost (the default for everything normal)
  body:           { fontFamily: fonts.jostRegular,    fontSize: 14, color: colors.textPrimary },
  bodyMedium:     { fontFamily: fonts.jostMedium,     fontSize: 14, color: colors.textPrimary },
  caption:        { fontFamily: fonts.jostRegular,    fontSize: 12, color: colors.textSecondary },

  // Price / numeric — Oswald
  price:          { fontFamily: fonts.oswaldBold,     fontSize: 16, color: colors.textPrimary },
  priceSmall:     { fontFamily: fonts.oswaldRegular,  fontSize: 12, color: colors.textSecondary },

  // Promo discount number — Oswald bold for impact
  promoDiscount:  { fontFamily: fonts.oswaldBold,     fontSize: 28, color: colors.white, letterSpacing: -0.5 },
  promoBadge:     { fontFamily: fonts.oswaldSemiBold, fontSize: 9,  color: colors.white, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  promoDesc:      { fontFamily: fonts.jostRegular,    fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  promoServiceName:{ fontFamily: fonts.oswaldSemiBold,fontSize: 11, color: colors.white },
  promoPrice:     { fontFamily: fonts.jostLight,      fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  promoBookBtn:   { fontFamily: fonts.oswaldBold,     fontSize: 11, color: colors.primary },

  // Location header
  locationLabel:  { fontFamily: fonts.jostRegular,    fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.4 },
  locationValue:  { fontFamily: fonts.jakartaSemiBold,fontSize: 15, color: colors.white },

  // Search
  searchInput:    { fontFamily: fonts.jostRegular,    fontSize: 14, color: colors.textPrimary },

  // Cards
  cardCategory:   { fontSize: 10, color: colors.primary, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  cardName:       { fontFamily: fonts.jostMedium,     fontSize: 13, color: colors.textPrimary },
  cardPrice:      { fontFamily: fonts.jostSemiBold,   fontSize: 15, color: colors.textPrimary },
  cardPriceLabel: { fontFamily: fonts.jostRegular,    fontSize: 9,  color: colors.textSecondary },
  cardPriceUnit:  { fontFamily: fonts.jostRegular,    fontSize: 11, color: colors.textSecondary },
};
