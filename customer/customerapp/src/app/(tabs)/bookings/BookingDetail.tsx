import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, spacing, radii, typography, fonts } from '../home/theme';
import type { Booking, BookingStatus } from './bookings.types';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:     { label: 'Pending',     color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  accepted:    { label: 'Accepted',    color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
  in_progress: { label: 'In Progress', color: '#5B21B6', bg: '#F5F3FF', border: '#DDD6FE' },
  completed:   { label: 'Completed',   color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' },
  cancelled:   { label: 'Cancelled',   color: '#991B1B', bg: '#FFF1F2', border: '#FECDD3' },
};

const STATUS_ACCENT: Record<BookingStatus, string> = {
  pending:     '#F59E0B',
  accepted:    '#3B82F6',
  in_progress: '#8B5CF6',
  completed:   '#10B981',
  cancelled:   '#EF4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.line} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  title: { fontFamily: fonts.oswaldSemiBold, fontSize: 11, color: colors.textSecondary, letterSpacing: 1.1, textTransform: 'uppercase' },
  line:  { flex: 1, height: 1, backgroundColor: '#F0F0F5' },
});

function InfoRow({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={infoStyles.row}>
      <View style={[infoStyles.iconWrap, accent && infoStyles.iconWrapAccent]}>
        <Ionicons name={icon} size={15} color={accent ? colors.primary : colors.textSecondary} />
      </View>
      <View style={infoStyles.content}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, accent && infoStyles.valueAccent]}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row:            { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 5 },
  iconWrap:       { width: 32, height: 32, borderRadius: radii.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  iconWrapAccent: { backgroundColor: '#ECFDF5' },
  content:        { flex: 1, justifyContent: 'center' },
  label:          { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, marginBottom: 1 },
  value:          { fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.textPrimary },
  valueAccent:    { color: colors.primary, fontFamily: fonts.jakartaSemiBold },
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
  // Slide-up animation
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(40);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleCancel = useCallback(() => {
    if (!booking) return;
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => { onCancelled(booking._id); onClose(); },
        },
      ],
    );
  }, [booking, onCancelled, onClose]);

  if (!booking) return null;

  const cfg    = STATUS_CONFIG[booking.status];
  const accent = STATUS_ACCENT[booking.status];
  const { partner, category, serviceAddress, cancellation, review } = booking;
  const canCancel = booking.status === 'pending' || booking.status === 'accepted';
  const canReview = booking.status === 'completed' && !review?.rating;

  const avatarUri =
    partner?.selfieUrl ??
    partner?.profilePhoto ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.fullName ?? 'P')}&background=16493c&color=fff&size=200`;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {/* Status accent dot */}
              <View style={[styles.accentDot, { backgroundColor: accent }]} />
              <Text style={styles.headerTitle}>Booking Details</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ── Partner card ── */}
            <View style={[styles.partnerCard, { borderLeftColor: accent }]}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
              <View style={styles.partnerInfo}>
                <Text style={styles.partnerName}>{partner?.fullName ?? 'Unknown Partner'}</Text>
                {partner?.phone && (
                  <View style={styles.phoneRow}>
                    <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.phoneText}>{partner.phone}</Text>
                  </View>
                )}
                {partner?.averageRating != null && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color={colors.star} />
                    <Text style={styles.ratingText}>{partner.averageRating.toFixed(1)}</Text>
                    <Text style={styles.ratingLabel}>rating</Text>
                  </View>
                )}
              </View>
              <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>

            {/* ── Service info ── */}
            <View style={styles.section}>
              <SectionHeader title="Service Info" />
              {category?.name && (
                <InfoRow icon="briefcase-outline" label="Category" value={category.name} />
              )}
              {booking.description && (
                <InfoRow icon="document-text-outline" label="Description" value={booking.description} />
              )}
              <InfoRow icon="calendar-outline" label="Scheduled" value={formatDateTime(booking.scheduledAt)} />
              {booking.startedAt && (
                <InfoRow icon="play-circle-outline" label="Started" value={formatDateTime(booking.startedAt)} />
              )}
              {booking.completedAt && (
                <InfoRow icon="checkmark-circle-outline" label="Completed" value={formatDateTime(booking.completedAt)} accent />
              )}
              {booking.visitingCredit != null && (
                <InfoRow icon="wallet-outline" label="Visiting Fee" value={`₹${booking.visitingCredit}`} accent />
              )}
              {booking.isEmergency && (
                <InfoRow icon="flash-outline" label="Booking Type" value="Emergency" />
              )}
            </View>

            {/* ── Address ── */}
            {serviceAddress && (
              <View style={styles.section}>
                <SectionHeader title="Service Address" />
                <View style={styles.addressCard}>
                  <View style={styles.addressIconWrap}>
                    <Ionicons name="location" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.addressText}>
                    {[
                      serviceAddress.house,
                      serviceAddress.street,
                      serviceAddress.locality,
                      serviceAddress.city,
                      serviceAddress.state,
                      serviceAddress.pincode,
                    ].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Cancellation ── */}
            {booking.status === 'cancelled' && cancellation && (
              <View style={styles.section}>
                <SectionHeader title="Cancellation" />
                <View style={styles.cancelCard}>
                  <View style={styles.cancelRow}>
                    <Ionicons name="person-outline" size={14} color="#991B1B" />
                    <Text style={styles.cancelBy}>
                      Cancelled by{' '}
                      <Text style={styles.cancelByBold}>
                        {cancellation.cancelledBy === 'customer' ? 'you' : 'the partner'}
                      </Text>
                    </Text>
                  </View>
                  {cancellation.reason ? (
                    <Text style={styles.cancelReason}>"{cancellation.reason}"</Text>
                  ) : null}
                  <Text style={styles.cancelDate}>{formatDateTime(cancellation.cancelledAt)}</Text>
                </View>
              </View>
            )}

            {/* ── Review ── */}
            {review?.rating && (
              <View style={styles.section}>
                <SectionHeader title="Your Review" />
                <View style={styles.reviewCard}>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= review.rating ? 'star' : 'star-outline'}
                        size={20}
                        color={colors.star}
                      />
                    ))}
                    <View style={styles.ratingNumWrap}>
                      <Text style={styles.ratingNum}>{review.rating}</Text>
                      <Text style={styles.ratingDenom}>/5</Text>
                    </View>
                  </View>
                  {review.comment ? (
                    <Text style={styles.reviewText}>"{review.comment}"</Text>
                  ) : null}
                </View>
              </View>
            )}
          </ScrollView>

          {/* ── Action buttons ── */}
          {(canReview || canCancel) && (
            <View style={styles.actions}>
              {canReview && (
                <TouchableOpacity
                  style={styles.reviewBtn}
                  onPress={() => { onClose(); onReviewPress(booking); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="star-outline" size={16} color="#fff" />
                  <Text style={styles.reviewBtnText}>Leave a Review</Text>
                </TouchableOpacity>
              )}
              {canCancel && (
                <TouchableOpacity
                  style={[styles.cancelBtn, canReview && { flex: 0.55 }]}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: 34,
    // Subtle top shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F8',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  headerTitle: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },

  // Partner card
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderLeftWidth: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#F0F0F5',
  },
  partnerInfo: {
    flex: 1,
    gap: 4,
  },
  partnerName: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneText: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontFamily: fonts.oswaldSemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  ratingLabel: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 11,
  },

  // Sections
  section: {
    gap: 2,
  },

  // Address
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#F0FDF4',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  addressIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  addressText: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },

  // Cancellation
  cancelCard: {
    backgroundColor: '#FFF1F2',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelBy: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: '#991B1B',
  },
  cancelByBold: {
    fontFamily: fonts.jakartaSemiBold,
  },
  cancelReason: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: '#B91C1C',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  cancelDate: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Review
  reviewCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingNumWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: spacing.xs,
  },
  ratingNum: {
    fontFamily: fonts.oswaldBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  ratingDenom: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  reviewText: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F3F8',
  },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 4,
  },
  reviewBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: '#fff',
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
    paddingVertical: spacing.sm + 4,
  },
  cancelBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: '#EF4444',
  },
});
