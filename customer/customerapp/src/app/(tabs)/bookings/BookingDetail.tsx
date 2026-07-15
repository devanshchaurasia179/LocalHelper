import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, spacing, radii, typography } from '../home/theme';
import { cancelBooking } from '@/constants/booking.api';
import type { Booking, BookingStatus } from './bookings.types';

// ─── Status config (same as BookingCard) ─────────────────────────────────────

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: '#B45309', bg: '#FEF3C7' },
  accepted:    { label: 'Accepted',    color: '#1D4ED8', bg: '#DBEAFE' },
  in_progress: { label: 'In Progress', color: '#6D28D9', bg: '#EDE9FE' },
  completed:   { label: 'Completed',   color: '#065F46', bg: '#D1FAE5' },
  cancelled:   { label: 'Cancelled',   color: '#991B1B', bg: '#FEE2E2' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <View style={infoStyles.content}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  content: { flex: 1 },
  label: { ...typography.caption, marginBottom: 1 },
  value: { ...typography.body, color: colors.textPrimary },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookingDetailProps {
  booking: Booking | null;
  visible: boolean;
  onClose: () => void;
  onCancelled: (bookingId: string) => void;
  onReviewPress: (booking: Booking) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingDetail({
  booking,
  visible,
  onClose,
  onCancelled,
  onReviewPress,
}: BookingDetailProps) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = useCallback(async () => {
    if (!booking) return;

    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelBooking(booking._id);
              onCancelled(booking._id);
              onClose();
            } catch (err: any) {
              Alert.alert(
                'Error',
                err?.response?.data?.message ?? 'Could not cancel booking. Try again.',
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }, [booking, onCancelled, onClose]);

  if (!booking) return null;

  const cfg = STATUS_CONFIG[booking.status];
  const { partner, category, serviceAddress, cancellation, review } = booking;
  const canCancel = booking.status === 'pending' || booking.status === 'accepted';
  const canReview = booking.status === 'completed' && !review?.rating;

  const avatarUri = partner?.profilePhoto
    ? partner.profilePhoto
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.fullName ?? 'P')}&background=12493B&color=fff&size=200`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Booking Details</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Partner card */}
            <View style={styles.partnerCard}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
              <View style={styles.partnerInfo}>
                <Text style={styles.partnerName}>{partner?.fullName ?? 'Unknown Partner'}</Text>
                {partner?.phone && (
                  <Text style={typography.caption}>{partner.phone}</Text>
                )}
                {partner?.averageRating != null && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color={colors.star} />
                    <Text style={styles.ratingText}>{partner.averageRating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>

            {/* Details section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service Info</Text>

              {category?.name && (
                <InfoRow icon="briefcase-outline" label="Category" value={category.name} />
              )}
              {booking.description && (
                <InfoRow icon="document-text-outline" label="Description" value={booking.description} />
              )}
              <InfoRow
                icon="calendar-outline"
                label="Scheduled At"
                value={formatDateTime(booking.scheduledAt)}
              />
              {booking.startedAt && (
                <InfoRow icon="play-circle-outline" label="Started At" value={formatDateTime(booking.startedAt)} />
              )}
              {booking.completedAt && (
                <InfoRow icon="checkmark-circle-outline" label="Completed At" value={formatDateTime(booking.completedAt)} />
              )}
              {booking.visitingCredit != null && (
                <InfoRow icon="wallet-outline" label="Visiting Credits" value={`₹${booking.visitingCredit}`} />
              )}
              {booking.isEmergency && (
                <InfoRow icon="flash-outline" label="Type" value="Emergency Booking" />
              )}
            </View>

            {/* Address section */}
            {serviceAddress && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Service Address</Text>
                <View style={styles.addressBox}>
                  <Ionicons name="location-outline" size={16} color={colors.primary} />
                  <Text style={styles.addressText}>
                    {[
                      serviceAddress.house,
                      serviceAddress.street,
                      serviceAddress.locality,
                      serviceAddress.city,
                      serviceAddress.state,
                      serviceAddress.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
              </View>
            )}

            {/* Cancellation section */}
            {cancellation && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cancellation</Text>
                <View style={styles.cancelBox}>
                  <Text style={styles.cancelBy}>
                    Cancelled by:{' '}
                    <Text style={{ fontWeight: '600' }}>
                      {cancellation.cancelledBy === 'customer' ? 'You' : 'Partner'}
                    </Text>
                  </Text>
                  {cancellation.reason && (
                    <Text style={styles.cancelReason}>Reason: {cancellation.reason}</Text>
                  )}
                  <Text style={styles.cancelDate}>{formatDateTime(cancellation.cancelledAt)}</Text>
                </View>
              </View>
            )}

            {/* Review section */}
            {review?.rating && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Review</Text>
                <View style={styles.reviewBox}>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= review.rating ? 'star' : 'star-outline'}
                        size={18}
                        color={colors.star}
                      />
                    ))}
                    <Text style={styles.ratingNum}>{review.rating}/5</Text>
                  </View>
                  {review.comment && (
                    <Text style={styles.reviewComment}>"{review.comment}"</Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actions}>
            {canReview && (
              <TouchableOpacity
                style={styles.reviewBtn}
                onPress={() => {
                  onClose();
                  onReviewPress(booking);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="star-outline" size={16} color={colors.primary} />
                <Text style={styles.reviewBtnText}>Leave a Review</Text>
              </TouchableOpacity>
            )}

            {canCancel && (
              <TouchableOpacity
                style={[styles.cancelBtn, cancelling && styles.btnDisabled]}
                onPress={handleCancel}
                disabled={cancelling}
                activeOpacity={0.8}
              >
                {cancelling ? (
                  <ActivityIndicator color="#EF4444" size="small" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                    <Text style={styles.cancelBtnText}>Cancel Booking</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '90%',
    paddingBottom: spacing.xl,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.name,
    fontSize: 18,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: '#E5E7EB',
  },
  partnerInfo: {
    flex: 1,
    gap: 2,
  },
  partnerName: {
    ...typography.name,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  addressBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  addressText: {
    ...typography.body,
    flex: 1,
    lineHeight: 20,
  },
  cancelBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cancelBy: {
    ...typography.body,
    color: '#991B1B',
  },
  cancelReason: {
    ...typography.caption,
    color: '#991B1B',
  },
  cancelDate: {
    ...typography.caption,
    color: '#9CA3AF',
  },
  reviewBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  reviewComment: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
  },
  reviewBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
  },
  cancelBtnText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
