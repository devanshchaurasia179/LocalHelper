import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { fetchCustomerBookings, cancelBooking } from '@/constants/booking.api';
import type { Booking } from '@/app/(tabs)/bookings/bookings.types';
import BookingDetail from '@/app/(tabs)/bookings/BookingDetail';
import { colors, spacing, radii, fonts } from './theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending:     { label: 'Pending',     color: '#F59E0B', icon: 'time-outline' },
  accepted:    { label: 'Accepted',    color: '#3B82F6', icon: 'checkmark-circle-outline' },
  in_progress: { label: 'In Progress', color: '#8B5CF6', icon: 'construct-outline' },
  completed:   { label: 'Completed',   color: '#10B981', icon: 'checkmark-done-outline' },
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Returns true if the booking was completed less than 1 hour ago */
function isRecentlyCompleted(booking: Booking): boolean {
  if (booking.status !== 'completed' || !booking.completedAt) return false;
  const completedAt = new Date(booking.completedAt).getTime();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return completedAt > oneHourAgo;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActiveBookingCard() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const loadActiveBooking = useCallback(async () => {
    try {
      const [pendingRes, acceptedRes, inProgressRes, completedRes] = await Promise.all([
        fetchCustomerBookings('pending', 1, 1),
        fetchCustomerBookings('accepted', 1, 1),
        fetchCustomerBookings('in_progress', 1, 1),
        fetchCustomerBookings('completed', 1, 5),
      ]);

      // Priority: in_progress > accepted > pending > recently completed
      const inProgress = inProgressRes.bookings[0];
      const accepted = acceptedRes.bookings[0];
      const pending = pendingRes.bookings[0];
      const recentlyCompleted = completedRes.bookings.find(isRecentlyCompleted);

      const active = inProgress ?? accepted ?? pending ?? recentlyCompleted ?? null;
      setBooking(active);
    } catch {
      setBooking(null);
    }
  }, []);

  // Reload on every screen focus
  useFocusEffect(
    useCallback(() => {
      loadActiveBooking();
    }, [loadActiveBooking])
  );

  const handleCancelled = useCallback(async (bookingId: string) => {
    try {
      await cancelBooking(bookingId);
      // Refresh the card state
      loadActiveBooking();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not cancel booking.');
    }
  }, [loadActiveBooking]);

  const handleDetailClose = useCallback(() => {
    setDetailVisible(false);
    // Refresh state when modal closes (in case partner started the work)
    loadActiveBooking();
  }, [loadActiveBooking]);

  if (!booking) return null;

  const config = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const partner = booking.partner;
  const avatarUri = partner.selfieUrl
    ?? partner.profilePhoto
    ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.fullName)}&background=12493B&color=fff&size=100`;

  const completionCode = booking.completionCode?.code;
  const showCode = (booking.status === 'in_progress' || booking.status === 'accepted') && completionCode;

  return (
    <>
      <Pressable
        style={styles.card}
        onPress={() => setDetailVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`View ${config.label} booking with ${partner.fullName}`}
      >
        {/* Left: Avatar */}
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
        />

        {/* Center: Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partner.fullName}
            </Text>
          </View>
          <Text style={styles.category} numberOfLines={1}>
            {booking.category?.name ?? 'Service'}
          </Text>
          <Text style={styles.time}>
            {formatTime(booking.scheduledAt)}
          </Text>
          {showCode && (
            <View style={styles.codeInline}>
              <Ionicons name="key" size={11} color="#5B21B6" />
              <Text style={styles.codeInlineLabel}>OTP:</Text>
              <Text style={styles.codeInlineValue}>{completionCode}</Text>
            </View>
          )}
        </View>

        {/* Right: Status badge + arrow */}
        <View style={styles.rightSection}>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '18' }]}>
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </Pressable>

      {/* Booking Detail Modal */}
      <BookingDetail
        booking={booking}
        visible={detailVisible}
        onClose={handleDetailClose}
        onCancelled={handleCancelled}
        onReviewPress={() => {
          // Close modal — review can be done from bookings tab
          setDetailVisible(false);
        }}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partnerName: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  category: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  time: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
    opacity: 0.8,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusText: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    fontWeight: '600',
  },
  // Completion code inline
  codeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  codeInlineLabel: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    color: '#5B21B6',
  },
  codeInlineValue: {
    fontFamily: fonts.oswaldBold,
    fontSize: 14,
    color: '#4C1D95',
    letterSpacing: 3,
  },
});
