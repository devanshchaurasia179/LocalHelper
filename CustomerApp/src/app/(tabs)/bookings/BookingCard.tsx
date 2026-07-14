import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, spacing, radii, typography } from '../home/theme';
import type { Booking, BookingStatus } from './bookings.types';

// ─── Status pill config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending:     { label: 'Pending',     color: '#B45309', bg: '#FEF3C7', icon: 'time-outline'          },
  accepted:    { label: 'Accepted',    color: '#1D4ED8', bg: '#DBEAFE', icon: 'checkmark-circle-outline'},
  in_progress: { label: 'In Progress', color: '#6D28D9', bg: '#EDE9FE', icon: 'construct-outline'       },
  completed:   { label: 'Completed',   color: '#065F46', bg: '#D1FAE5', icon: 'checkmark-done-outline'  },
  cancelled:   { label: 'Cancelled',   color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle-outline'    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookingCardProps {
  booking: Booking;
  onPress: (booking: Booking) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookingCard({ booking, onPress }: BookingCardProps) {
  const { status, partner, category, scheduledAt, visitingCredit, isEmergency, review } = booking;
  const cfg = STATUS_CONFIG[status];

  const avatarUri = partner?.profilePhoto
    ? partner.profilePhoto
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.fullName ?? 'P')}&background=12493B&color=fff&size=200`;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(booking)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Booking with ${partner?.fullName ?? 'partner'}, status ${cfg.label}`}
    >
      {/* Partner info row */}
      <View style={styles.row}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />

        <View style={styles.info}>
          <Text style={styles.partnerName} numberOfLines={1}>
            {partner?.fullName ?? 'Unknown Partner'}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {category?.name ?? 'General Service'}
          </Text>
        </View>

        {/* Status pill */}
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={12} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Details row */}
      <View style={styles.detailsRow}>
        {/* Scheduled date + time */}
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.detailText}>{formatDate(scheduledAt)}</Text>
        </View>

        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.detailText}>{formatTime(scheduledAt)}</Text>
        </View>

        {/* Visiting credits */}
        {visitingCredit != null && (
          <View style={styles.detailItem}>
            <Ionicons name="wallet-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.detailText}>₹{visitingCredit}</Text>
          </View>
        )}

        {/* Emergency badge */}
        {isEmergency && (
          <View style={styles.emergencyBadge}>
            <Ionicons name="flash" size={11} color="#fff" />
            <Text style={styles.emergencyText}>Emergency</Text>
          </View>
        )}
      </View>

      {/* Star rating row for completed + reviewed */}
      {status === 'completed' && review?.rating && (
        <View style={styles.reviewRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < review.rating ? 'star' : 'star-outline'}
              size={13}
              color={colors.star}
            />
          ))}
          {review.comment ? (
            <Text style={styles.reviewComment} numberOfLines={1}>
              {review.comment}
            </Text>
          ) : null}
        </View>
      )}

      {/* "Leave a review" nudge for completed + not reviewed */}
      {status === 'completed' && !review?.rating && (
        <View style={styles.reviewNudge}>
          <Ionicons name="star-half-outline" size={13} color={colors.primary} />
          <Text style={styles.reviewNudgeText}>Tap to rate this service</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  partnerName: {
    ...typography.name,
    fontSize: 14,
  },
  category: {
    ...typography.caption,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F5',
    marginVertical: spacing.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    ...typography.caption,
    fontSize: 12,
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  emergencyText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.sm,
  },
  reviewComment: {
    ...typography.caption,
    fontSize: 12,
    marginLeft: spacing.xs,
    flex: 1,
    fontStyle: 'italic',
  },
  reviewNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  reviewNudgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
});
