import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PromoOffer } from './types';
import { colors, spacing, radii, typography } from './theme';

interface PromoBannerProps {
  offer: PromoOffer;
  onBookPress?: () => void;
}

export default function PromoBanner({ offer, onBookPress }: PromoBannerProps) {
  return (
    <View style={styles.shadowWrap}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* decorative background accent */}
        <View style={styles.bgCircle} pointerEvents="none" />

        <View style={styles.textBlock}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LIMITED OFFER</Text>
          </View>

          <Text style={styles.discount}>
            Save {offer.discountPercent}%
          </Text>

          <Text style={styles.description} numberOfLines={2}>
            {offer.description}
          </Text>

          <View style={styles.chip}>
            <View style={styles.chipTextWrap}>
              <Text style={styles.chipService} numberOfLines={1}>
                {offer.serviceName}
              </Text>
              <Text style={styles.chipPrice}>${offer.servicePrice}/hr</Text>
            </View>

            <Pressable
              onPress={onBookPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Book ${offer.serviceName} now`}
              style={({ pressed }) => [
                styles.bookButton,
                pressed && styles.bookButtonPressed,
              ]}
            >
              <Text style={styles.bookButtonText}>Book Now</Text>
            </Pressable>
          </View>
        </View>

        {offer.image ? (
          <Image
            source={{ uri: offer.image }}
            style={styles.image}
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    ...Platform.select({
      ios: {
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  container: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    minHeight: 220,
    paddingLeft: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  bgCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
    right: -60,
    top: -60,
  },
  textBlock: {
    maxWidth: '62%',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.white,
  },
  discount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.chipBackground,
    borderRadius: radii.pill,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    marginTop: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chipTextWrap: {
    flexShrink: 1,
  },
  chipService: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  chipPrice: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  bookButton: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  bookButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  image: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 150,
    height: 200,
    resizeMode: 'contain',
  },
});