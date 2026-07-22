import { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '../home/theme';
import type { NearbyPartner } from '@/api/nearby.api';

export type ActiveBookingStatus = 'pending' | 'accepted' | 'in_progress' | null;

interface PartnerCardProps {
  partner: NearbyPartner;
  onPress: () => void;
  /** If this partner already has an active booking, pass its status to block re-booking */
  activeBookingStatus?: ActiveBookingStatus;
}

export default function PartnerCard({ partner, onPress, activeBookingStatus = null }: PartnerCardProps) {
  const isBooked = activeBookingStatus !== null;
  const avatarUri = partner.selfieUrl
    ?? partner.profilePhoto
    ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.fullName)}&background=16493c&color=fff&size=200`;

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
      onPress={isBooked ? undefined : onPress}
      onPressIn={isBooked ? undefined : pressIn}
      onPressOut={isBooked ? undefined : pressOut}
      accessibilityRole="button"
      accessibilityLabel={`View profile of ${partner.fullName}${partner.isOnline ? ', online now' : ''}${isBooked ? `, currently ${getBookingLabel(activeBookingStatus)}` : ''}`}
      disabled={isBooked}
    >
      <Animated.View style={[styles.card, isBooked && styles.cardBooked, isBooked && { paddingTop: spacing.md + 22 }, { transform: [{ scale }] }]}>
        {/* ── Booking status banner ── */}
        {isBooked && (
          <View style={[styles.bookingBanner, getBannerStyle(activeBookingStatus)]}>
            <Ionicons name={getBannerIcon(activeBookingStatus)} size={12} color={getBannerColor(activeBookingStatus)} />
            <Text style={[styles.bookingBannerText, { color: getBannerColor(activeBookingStatus) }]}>
              {getBookingLabel(activeBookingStatus)}
            </Text>
          </View>
        )}
        {/* ── Avatar ── */}
        <View style={styles.avatarWrap}>
          {!imageLoaded && <View style={styles.avatarPlaceholder} />}
          <Image
            source={{ uri: avatarUri }}
            style={StyleSheet.absoluteFill}
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
          {!partner.isOnline && (
            <View style={styles.offlineBadge}>
              <View style={styles.offlineDot} />
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
            {/* Online/Offline status chip */}
            <View style={[styles.tag, partner.isOnline ? styles.tagOnline : styles.tagOffline]}>
              <View style={[styles.statusChipDot, partner.isOnline ? styles.statusChipDotOnline : styles.statusChipDotOffline]} />
              <Text style={[styles.tagText, partner.isOnline ? styles.tagOnlineText : styles.tagOfflineText]}>
                {partner.isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
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

function getBookingLabel(status: ActiveBookingStatus): string {
  switch (status) {
    case 'pending':
      return 'Booking Pending';
    case 'accepted':
      return 'Booked – Busy';
    case 'in_progress':
      return 'Service In Progress';
    default:
      return '';
  }
}

function getBannerIcon(status: ActiveBookingStatus): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'pending':
      return 'time-outline';
    case 'accepted':
      return 'checkmark-circle-outline';
    case 'in_progress':
      return 'construct-outline';
    default:
      return 'information-circle-outline';
  }
}

function getBannerColor(status: ActiveBookingStatus): string {
  switch (status) {
    case 'pending':
      return '#D97706'; // amber
    case 'accepted':
      return '#2563EB'; // blue
    case 'in_progress':
      return '#7C3AED'; // purple
    default:
      return colors.textSecondary;
  }
}

function getBannerStyle(status: ActiveBookingStatus) {
  switch (status) {
    case 'pending':
      return { backgroundColor: '#FEF3C7' }; // amber light
    case 'accepted':
      return { backgroundColor: '#DBEAFE' }; // blue light
    case 'in_progress':
      return { backgroundColor: '#EDE9FE' }; // purple light
    default:
      return {};
  }
}

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
  cardBooked: {
    opacity: 0.7,
    borderColor: 'rgba(0,0,0,0.08)',
  },

  // Booking banner
  bookingBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  bookingBannerText: {
    fontSize: 11,
    fontWeight: '700',
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
    ...StyleSheet.absoluteFill,
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
  offlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#9CA3AF',
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
  tagOnline: {
    backgroundColor: '#ECFDF5',
  },
  tagOnlineText: {
    color: '#059669',
  },
  tagOffline: {
    backgroundColor: '#F3F4F6',
  },
  tagOfflineText: {
    color: '#6B7280',
  },
  statusChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipDotOnline: {
    backgroundColor: '#22C55E',
  },
  statusChipDotOffline: {
    backgroundColor: '#9CA3AF',
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