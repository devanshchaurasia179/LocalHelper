import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DashColors, DashSpacing, DashType, DashRadius } from '../theme';
import { PromoInfo } from '../types';

interface PromoBannerProps {
  promo: PromoInfo;
  onPress?: () => void;
}

export function PromoBanner({ promo, onPress }: PromoBannerProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${promo.headline}. ${promo.subline}`}
    >
      <LinearGradient
        colors={promo.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        {/* Decorative circles */}
        <View style={[styles.circle, styles.circleLarge]} />
        <View style={[styles.circle, styles.circleSmall]} />

        {/* Left: text */}
        <View style={styles.textBlock}>
          <Text style={styles.headline}>{promo.headline}</Text>
          <Text style={styles.subline}>{promo.subline}</Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Book now"
          >
            <Text style={styles.ctaText}>Book Now</Text>
            <Ionicons name="arrow-forward" size={14} color={DashColors.primary} />
          </TouchableOpacity>
        </View>

        {/* Right: discount pill */}
        <View style={styles.discountPill}>
          <Text style={styles.discountText}>{promo.discountLabel}</Text>
          <Text style={styles.discountOff}>OFF</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: DashRadius.xl,
    padding: DashSpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 120,
  },

  // decorative background circles
  circle: {
    position: 'absolute',
    borderRadius: DashRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  circleLarge: {
    width: 140,
    height: 140,
    top: -40,
    right: 60,
  },
  circleSmall: {
    width: 80,
    height: 80,
    bottom: -30,
    right: 20,
  },

  textBlock: {
    flex: 1,
    gap: DashSpacing.xs,
  },
  headline: {
    fontSize: DashType.lg,
    fontWeight: '800',
    color: DashColors.textOnPrimary,
    lineHeight: 26,
  },
  subline: {
    fontSize: DashType.sm,
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 18,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: DashSpacing.sm,
    backgroundColor: DashColors.textOnPrimary,
    alignSelf: 'flex-start',
    paddingHorizontal: DashSpacing.md,
    paddingVertical: 6,
    borderRadius: DashRadius.full,
  },
  ctaText: {
    fontSize: DashType.sm,
    fontWeight: '700',
    color: DashColors.primary,
  },

  discountPill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: DashRadius.lg,
    paddingHorizontal: DashSpacing.md,
    paddingVertical: DashSpacing.sm,
    marginLeft: DashSpacing.md,
    minWidth: 64,
  },
  discountText: {
    fontSize: DashType.xl,
    fontWeight: '800',
    color: DashColors.textOnPrimary,
    lineHeight: 30,
  },
  discountOff: {
    fontSize: DashType.xs,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
  },
});
