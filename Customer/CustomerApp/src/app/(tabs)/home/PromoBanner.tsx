import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PromoOffer } from './types';
import { colors, spacing, radii, typography } from './theme';

interface PromoBannerProps {
  offer: PromoOffer;
  onBookPress?: () => void;
}

export default function PromoBanner({ offer, onBookPress }: PromoBannerProps) {
  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.textBlock}>
        <Text style={styles.discount}>Get {offer.discountPercent}%</Text>
        <Text style={styles.description}>{offer.description}</Text>

        <View style={styles.chip}>
          <View>
            <Text style={styles.chipService}>{offer.serviceName}</Text>
            <Text style={styles.chipPrice}>${offer.servicePrice}/hour</Text>
          </View>

          <TouchableOpacity
            style={styles.bookButton}
            onPress={onBookPress}
            activeOpacity={0.85}
          >
            <Text style={styles.bookButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Image source={{ uri: offer.image }} style={styles.image} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    overflow: 'hidden',
    minHeight: 220,
    paddingLeft: spacing.md,
    paddingTop: spacing.md,
  },
  textBlock: {
    maxWidth: '62%',
  },
  discount: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
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
    backgroundColor: colors.chipBackground,
    borderRadius: radii.pill,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    marginTop: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  chipService: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  chipPrice: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  bookButton: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
