import { useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, spacing, radii, typography, fonts } from '../home/theme';
import type { Booking, BookingStatus } from './bookings.types';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; color: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending:     { label: 'Pending',     color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', icon: 'time-outline'           },
  accepted:    { label: 'Accepted',    color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: 'checkmark-circle-outline'},
  in_progress: { label: 'In Progress', color: '#5B21B6', bg: '#F5F3FF', border: '#DDD6FE', icon: 'construct-outline'      },
  completed:   { label: 'Completed',   color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: 'checkmark-done-outline' },
  cancelled:   { label: 'Cancelled',   color: '#991B1B', bg: '#FFF1F2', border: '#FECDD3', icon: 'close-circle-outline'   },
};

// status → left-border accent color
const STATUS_ACCENT: Record<BookingStatus, string> = {
  pending:     '#F59E0B',
  accepted:    '#3B82F6',
  in_progress: '#8B5CF6',
  completed:   '#10B981',
  cancelled:   '#EF4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookingCardProps {
  booking: Booking;
  onPress: (booking: Booking) => void;
}

export default function BookingCard({ booking, onPress }: BookingCardProps) {
  const { status, partner, category, scheduledAt, visitingCredit, isEmergency, review } = booking;
  const cfg    = STATUS_CONFIG[status];
  const accent = STATUS_ACCENT[status];

  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    Animated.timing(scale, {
      toValue: 0.977,
      duration: 80,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const pressOut = useCallback(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    onPress(booking);
  }, [booking, onPress]);

  const avatarUri =
    partner?.selfieUrl ??
    partner?.profilePhoto ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.fullName ?? 'P')}&background=16493c&color=fff&size=200`;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={`Booking with ${partner?.fullName ?? 'partner'}, ${cfg.label}`}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        <View style={styles.inner}>
          {/* ── Top row: avatar + info + status ── */}
          <View style={styles.topRow}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            </View>

            <View style={styles.info}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {partner?.fullName ?? 'Unknown Partner'}
              </Text>
              <Text style={styles.categoryText} numberOfLines={1}>
                {category?.name ?? 'General Service'}
              </Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Ionicons name={cfg.icon} size={11} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Meta chips row ── */}
          <View style={styles.metaRow}>
            <MetaChip icon="calendar-outline" label={formatDate(scheduledAt)} />
            <MetaChip icon="time-outline"     label={formatTime(scheduledAt)} />
            {visitingCredit != null && (
              <MetaChip icon="wallet-outline" label={`₹${visitingCredit}`} highlight />
            )}
            {isEmergency && (
              <View style={styles.emergencyChip}>
                <Ionicons name="flash" size={10} color="#fff" />
                <Text style={styles.emergencyText}>Emergency</Text>
              </View>
            )}
          </View>

          {/* ── Completion code nudge ── */}
          {(status === 'accepted' || status === 'in_progress') && booking.completionCode?.code ? (
            <View style={styles.codeNudgeRow}>
              <Ionicons name="key-outline" size={13} color="#5B21B6" />
              <Text style={styles.codeNudgeText}>Your code: </Text>
              <Text style={styles.codeNudgeValue}>{booking.completionCode.code}</Text>
              <Text style={styles.codeNudgeHint}> — share with partner</Text>
            </View>
          ) : null}

          {/* ── Review section ── */}
          {status === 'completed' && review?.rating ? (
            <View style={styles.reviewRow}>
              <View style={styles.starsSmall}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Ionicons
                    key={i}
                    name={i <= review.rating ? 'star' : 'star-outline'}
                    size={12}
                    color={colors.star}
                  />
                ))}
              </View>
              {review.comment ? (
                <Text style={styles.reviewComment} numberOfLines={1}>
                  "{review.comment}"
                </Text>
              ) : null}
            </View>
          ) : status === 'completed' && !review?.rating ? (
            <View style={styles.nudgeRow}>
              <Ionicons name="star-half-outline" size={13} color={colors.primary} />
              <Text style={styles.nudgeText}>Tap to leave a review</Text>
            </View>
          ) : null}
        </View>

        {/* Chevron */}
        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-forward" size={16} color={colors.navInactive} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── MetaChip ─────────────────────────────────────────────────────────────────

function MetaChip({
  icon,
  label,
  highlight = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.metaChip, highlight && styles.metaChipHighlight]}>
      <Ionicons name={icon} size={12} color={highlight ? colors.primary : colors.textSecondary} />
      <Text style={[styles.metaText, highlight && styles.metaTextHighlight]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EBEBF0',
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: radii.md,
    borderBottomLeftRadius: radii.md,
  },
  inner: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.sm + 4,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: '#F0F0F5',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  partnerName: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  categoryText: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F3F8',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaChipHighlight: {
    backgroundColor: '#ECFDF5',
  },
  metaText: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  metaTextHighlight: {
    fontFamily: fonts.jostSemiBold,
    color: colors.primary,
  },
  emergencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  emergencyText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 10,
    color: '#fff',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFFBEB',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  starsSmall: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  nudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  nudgeText: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    color: colors.primary,
  },
  codeNudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  codeNudgeText: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: '#5B21B6',
  },
  codeNudgeValue: {
    fontFamily: fonts.oswaldSemiBold,
    fontSize: 15,
    color: '#4C1D95',
    letterSpacing: 3,
  },
  codeNudgeHint: {
    fontFamily: fonts.jostRegular,
    fontSize: 10,
    color: '#7C3AED',
    opacity: 0.8,
  },
  chevronWrap: {
    justifyContent: 'center',
    paddingRight: spacing.sm,
  },
});
