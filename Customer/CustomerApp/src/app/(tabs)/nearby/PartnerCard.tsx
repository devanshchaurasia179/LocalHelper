import { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '../home/theme';
import type { NearbyPartner } from '@/api/nearby.api';

interface PartnerCardProps {
  partner: NearbyPartner;
  onPress: () => void;
}

export default function PartnerCard({ partner, onPress }: PartnerCardProps) {
  const avatarUri = partner.profilePhoto
    ? partner.profilePhoto
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.fullName)}&background=16493c&color=fff&size=200`;

  const primaryCategory = partner.categories[0]?.name ?? 'General';
  const isTopRated = partner.averageRating >= 4.5 && partner.totalReviews >= 5;

  const [imageLoaded, setImageLoaded] = useState(false);

  // Press feedback
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  // Pulsing online dot
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!partner.isOnline) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [partner.isOnline, pulse]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={`View profile of ${partner.fullName}${partner.isOnline ? ', online now' : ''}`}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {/* ── Avatar ── */}
        <View style={styles.avatarWrap}>
          {!imageLoaded && <View style={styles.avatarPlaceholder} />}
          <Image
            source={{ uri: avatarUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={200}
            onLoad={() => setImageLoaded(true)}
          />
          {partner.isOnline && (
            <View style={styles.onlineBadge}>
              <Animated.View
                style={[
                  styles.onlinePing,
                  { transform: [{ scale: pulse }], opacity: pulse.interpolate({ inputRange: [1, 1.6], outputRange: [0.55, 0] }) },
                ]}
              />
              <View style={styles.onlineDot} />
            </View>
          )}
        </View>

        {/* ── Main info ── */}
        <View style={styles.body}>
          {/* Name + top-rated badge */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {partner.fullName}
            </Text>
            {isTopRated && (
              <View style={styles.topBadge}>
                <Ionicons name="ribbon" size={10} color="#B45309" />
                <Text style={styles.topBadgeText}>Top rated</Text>
              </View>
            )}
          </View>

          {/* Category */}
          <Text style={styles.category} numberOfLines={1}>
            {primaryCategory}
            {partner.categories.length > 1
              ? ` +${partner.categories.length - 1}`
              : ''}
          </Text>

          {/* Stats row: rating | jobs | distance */}
          <View style={styles.statsRow}>
            {/* Rating */}
            <View style={[styles.ratingPill, partner.averageRating === 0 && styles.ratingPillMuted]}>
              <Ionicons
                name="star"
                size={11}
                color={partner.averageRating > 0 ? colors.star : colors.navInactive}
              />
              <Text style={[styles.ratingText, partner.averageRating === 0 && styles.ratingTextMuted]}>
                {partner.averageRating > 0 ? partner.averageRating.toFixed(1) : 'New'}
              </Text>
              {partner.totalReviews > 0 && (
                <Text style={styles.statSub}>({partner.totalReviews})</Text>
              )}
            </View>

            <View style={styles.dot} />

            {/* Jobs done */}
            <View style={styles.stat}>
              <Ionicons name="checkmark-circle-outline" size={11} color={colors.primary} />
              <Text style={styles.statText}>{partner.completedJobs ?? 0} jobs</Text>
            </View>

            <View style={styles.dot} />

            {/* Distance */}
            <View style={styles.stat}>
              <Ionicons name="location-outline" size={11} color={colors.primary} />
              <Text style={styles.statText}>{formatDistance(partner.distanceKm)}</Text>
            </View>
          </View>

          {/* Tags: experience | visiting fee | emergency */}
          <View style={styles.tagsRow}>
            {partner.experience != null && partner.experience > 0 && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{partner.experience} yr exp</Text>
              </View>
            )}
            {partner.visitingCredits != null && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>₹{partner.visitingCredits} visit</Text>
              </View>
            )}
            {partner.emergencyAvailable && (
              <View style={[styles.tag, styles.tagEmergency]}>
                <Ionicons name="flash" size={9} color="#EF4444" />
                <Text style={[styles.tagText, styles.tagEmergencyText]}>Emergency</Text>
              </View>
            )}
          </View>

          {/* Skills preview */}
          {partner.skills?.length > 0 && (
            <Text style={styles.skills} numberOfLines={1}>
              {partner.skills.slice(0, 3).join(' · ')}
              {partner.skills.length > 3 ? ` +${partner.skills.length - 3}` : ''}
            </Text>
          )}
        </View>

        {/* ── Arrow ── */}
        <View style={styles.arrowWrap}>
          <Ionicons name="chevron-forward" size={18} color={colors.navInactive} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },

  // Avatar
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E5E7EB',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlinePing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
  },
  onlineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: colors.background,
  },

  // Body
  body: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FEF3C7',
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  topBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingPillMuted: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  ratingTextMuted: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statSub: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.navInactive,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EDF7F4',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  tagEmergency: {
    backgroundColor: '#FEE2E2',
  },
  tagEmergencyText: {
    color: '#EF4444',
  },

  // Skills
  skills: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Arrow
  arrowWrap: {
    justifyContent: 'center',
    alignSelf: 'center',
  },
});