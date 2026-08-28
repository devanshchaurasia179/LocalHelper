import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, fonts, typography } from './theme';

export type NearbyEmptyVariant = 'no-services' | 'filtered' | 'error';

interface NearbyEmptyStateProps {
  variant: NearbyEmptyVariant;
  /** Error message to show when variant is 'error'. */
  message?: string;
  /** Retry / refresh handler (shown for 'no-services' and 'error'). */
  onRetry?: () => void;
  /** Clear-filters handler (shown for 'filtered'). */
  onClearFilters?: () => void;
  /** Change-location handler (shown for 'no-services'). */
  onChangeLocation?: () => void;
}

interface VariantConfig {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

const VARIANTS: Record<NearbyEmptyVariant, VariantConfig> = {
  'no-services': {
    icon: 'location-outline',
    title: 'No services near you yet',
    subtitle:
      "We couldn't find any available partners around this location. Try a different address or check back a little later.",
  },
  filtered: {
    icon: 'options-outline',
    title: 'No matches for these filters',
    subtitle:
      'Nearby services exist, but none match your current filters. Loosen or clear them to see more.',
  },
  error: {
    icon: 'cloud-offline-outline',
    title: "Couldn't load nearby services",
    subtitle: 'Something went wrong while fetching partners near you.',
  },
};

/**
 * A polished empty / error state for the Home page "Nearby Services" area.
 * Distinguishes between there being no partners nearby, filters hiding
 * everything, and a network/error failure — each with a helpful action.
 */
export default function NearbyEmptyState({
  variant,
  message,
  onRetry,
  onClearFilters,
  onChangeLocation,
}: NearbyEmptyStateProps) {
  const config = VARIANTS[variant];
  const subtitle = variant === 'error' && message ? message : config.subtitle;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={config.icon} size={40} color={colors.primary} />
      </View>

      <Text style={styles.title}>{config.title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.actions}>
        {variant === 'filtered' && onClearFilters && (
          <PrimaryButton icon="close-circle-outline" label="Clear filters" onPress={onClearFilters} />
        )}

        {variant === 'no-services' && onChangeLocation && (
          <PrimaryButton icon="navigate-outline" label="Change location" onPress={onChangeLocation} />
        )}

        {(variant === 'no-services' || variant === 'error') && onRetry && (
          <SecondaryButton icon="refresh-outline" label="Try again" onPress={onRetry} />
        )}
      </View>
    </View>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

function PrimaryButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={colors.white} />
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(22, 73, 60, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  primaryBtnText: {
    fontFamily: fonts.jostMedium,
    fontSize: 13,
    color: colors.white,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  secondaryBtnText: {
    fontFamily: fonts.jostMedium,
    fontSize: 13,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
