import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';

import { colors, spacing, radii, typography } from './theme';
import { useBookPartner } from '@/hooks/useBookPartner';
import { initiateChat, initiateCall } from '@/constants/booking.api';
import { getOrCreateConversation } from '@/api/chat.api';
import type { NearbyPartner } from '@/api/nearby.api';
import { nearbyCache } from '@/cache/nearbyCache';
import { useRouter } from 'expo-router';

// ─── Offline Booking Modal ────────────────────────────────────────────────────

type OfflineModalType = 'emergency_available' | 'no_emergency' | 'success' | null;

interface OfflineBookingModalProps {
  type: OfflineModalType;
  partnerName: string;
  loading: boolean;
  onClose: () => void;
  onConfirmEmergency: () => void;
}

function OfflineBookingModal({
  type,
  partnerName,
  loading,
  onClose,
  onConfirmEmergency,
}: OfflineBookingModalProps) {
  if (!type) return null;

  const isEmergencyAvailable = type === 'emergency_available';
  const isSuccess = type === 'success';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <Pressable style={modalStyles.backdrop} onPress={onClose} />
        <View style={modalStyles.container}>
          {/* Icon */}
          <View style={[modalStyles.iconCircle, isSuccess ? modalStyles.iconSuccess : isEmergencyAvailable ? modalStyles.iconWarning : modalStyles.iconError]}>
            <Ionicons
              name={isSuccess ? 'checkmark-circle' : isEmergencyAvailable ? 'flash' : 'moon'}
              size={36}
              color={isSuccess ? '#059669' : isEmergencyAvailable ? '#D97706' : '#DC2626'}
            />
          </View>

          {/* Title */}
          <Text style={modalStyles.title}>
            {isSuccess
              ? 'Emergency Booking Confirmed!'
              : isEmergencyAvailable
              ? 'Partner is Offline'
              : 'Partner Unavailable'}
          </Text>

          {/* Body */}
          <Text style={modalStyles.body}>
            {isSuccess
              ? `Your emergency booking with ${partnerName} has been placed successfully.`
              : isEmergencyAvailable
              ? `${partnerName} is currently offline. You can book an emergency service, but you may have to pay extra charges.`
              : `${partnerName} is currently offline and does not accept emergency bookings. Please try again after some time.`}
          </Text>

          {/* Extra charge notice for emergency */}
          {isEmergencyAvailable && (
            <View style={modalStyles.noticeRow}>
              <Ionicons name="information-circle-outline" size={16} color="#D97706" />
              <Text style={modalStyles.noticeText}>
                Emergency bookings may include additional charges
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={modalStyles.btnRow}>
            {isSuccess ? (
              <TouchableOpacity style={modalStyles.btnPrimary} onPress={onClose} activeOpacity={0.85}>
                <Text style={modalStyles.btnPrimaryText}>Done</Text>
              </TouchableOpacity>
            ) : isEmergencyAvailable ? (
              <>
                <TouchableOpacity style={modalStyles.btnSecondary} onPress={onClose} activeOpacity={0.85}>
                  <Text style={modalStyles.btnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalStyles.btnEmergency, loading && { opacity: 0.6 }]}
                  onPress={onConfirmEmergency}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="flash" size={16} color="#fff" />
                      <Text style={modalStyles.btnEmergencyText}>Book Emergency</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={modalStyles.btnPrimary} onPress={onClose} activeOpacity={0.85}>
                <Text style={modalStyles.btnPrimaryText}>OK, Got it</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconWarning: {
    backgroundColor: '#FEF3C7',
  },
  iconError: {
    backgroundColor: '#FEE2E2',
  },
  iconSuccess: {
    backgroundColor: '#D1FAE5',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  btnEmergency: {
    flex: 1.3,
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnEmergencyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface PartnerDetailSheetProps {
  partner: NearbyPartner | null;
  visible: boolean;
  onClose: () => void;
  onBooked: () => void;
  /** Called after a successful call deduction — passes partnerId and minutes unlocked */
  onCallPaid?: (partnerId: string, durationMinutes: number) => void;
  /** Called to initiate a real-time LiveKit call to the partner */
  onCallInitiate?: (partner: NearbyPartner) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date) {
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Haversine formula — returns distance in km between two lat/lng points.
 */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 0.1) return '< 0.1 km';
  return `${km.toFixed(1)} km`;
}

// ─── Row component ────────────────────────────────────────────────────────────

function InfoChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={chipStyles.chip}>
      <Ionicons name={icon} size={13} color={colors.primary} />
      <Text style={chipStyles.text}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF7F4',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function PartnerDetailSheet({
  partner,
  visible,
  onClose,
  onBooked,
  onCallPaid,
  onCallInitiate,
}: PartnerDetailSheetProps) {
  const { booking, error, book, reset } = useBookPartner();
  const router = useRouter();

  // ── Distance (calculated from the selected address coords) ───────────────
  const [displayDistanceKm, setDisplayDistanceKm] = useState<number | null>(null);

  useEffect(() => {
    if (!visible || !partner) {
      setDisplayDistanceKm(null);
      return;
    }

    // Use the server-computed value as the immediate display value.
    // This was already calculated from the selected address coords when
    // the nearby fetch was made — so it's already correct.
    setDisplayDistanceKm(partner.distanceKm);

    // Optionally refine with a client-side haversine using the cached
    // selected address coords (avoids any GPS call entirely).
    const cachedCoords = nearbyCache.getCoords();
    if (!cachedCoords) return;

    const partnerCoords = partner.serviceLocation?.coordinates;
    if (!partnerCoords || partnerCoords.length < 2) return;

    // GeoJSON order: [longitude, latitude]
    const [partnerLng, partnerLat] = partnerCoords;
    const km = haversineKm(
      cachedCoords.lat,
      cachedCoords.lng,
      partnerLat,
      partnerLng,
    );
    setDisplayDistanceKm(km);
  }, [visible, partner]);

  // ── Form state ─────────────────────────────────────────────────────────────
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [scheduledAt, setScheduledAt] = useState<Date>(tomorrow);
  const [scheduledEndAt, setScheduledEndAt] = useState<Date>(() => {
    const end = new Date(tomorrow);
    end.setHours(end.getHours() + 1);
    return end;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  // ── Offline modal state ─────────────────────────────────────────────────────
  const [offlineModalType, setOfflineModalType] = useState<OfflineModalType>(null);
  const [emergencyBooking, setEmergencyBooking] = useState(false);

  // ── Chat / Call state ──────────────────────────────────────────────────────
  const [chatLoading, setChatLoading] = useState(false);
  const [callLoading, setCallLoading] = useState(false);
  /** Minutes unlocked after a successful call deduction — shown as a banner */
  const [callDuration, setCallDuration] = useState<number | null>(null);

  // Reset form when sheet opens with a new partner
  useEffect(() => {
    if (visible) {
      reset();
      const tmrw = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setScheduledAt(tmrw);
      const end = new Date(tmrw);
      end.setHours(end.getHours() + 1);
      setScheduledEndAt(end);
      setDescription('');
      setIsEmergency(false);
      setShowDatePicker(false);
      setShowTimePicker(false);
      setShowEndDatePicker(false);
      setShowEndTimePicker(false);
      setOfflineModalType(null);
      setEmergencyBooking(false);
      setCallDuration(null);
    }
  }, [visible, reset]);

  const handleDateChange = useCallback(
    (_: DateTimePickerEvent, selected?: Date) => {
      setShowDatePicker(false);
      if (selected) {
        setScheduledAt((prev) => {
          const next = new Date(selected);
          next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
          return next;
        });
        // On Android open time picker right after date is picked
        if (Platform.OS === 'android') setShowTimePicker(true);
      }
    },
    []
  );

  const handleTimeChange = useCallback(
    (_: DateTimePickerEvent, selected?: Date) => {
      setShowTimePicker(false);
      if (selected) {
        setScheduledAt((prev) => {
          const next = new Date(prev);
          next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          return next;
        });
      }
    },
    []
  );

  // ── End date/time handlers (for time-based pricing) ────────────────────────
  const handleEndDateChange = useCallback(
    (_: DateTimePickerEvent, selected?: Date) => {
      setShowEndDatePicker(false);
      if (selected) {
        setScheduledEndAt((prev) => {
          const next = new Date(selected);
          next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
          return next;
        });
        if (Platform.OS === 'android') setShowEndTimePicker(true);
      }
    },
    []
  );

  const handleEndTimeChange = useCallback(
    (_: DateTimePickerEvent, selected?: Date) => {
      setShowEndTimePicker(false);
      if (selected) {
        setScheduledEndAt((prev) => {
          const next = new Date(prev);
          next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          return next;
        });
      }
    },
    []
  );

  // ── Time-based pricing calculation ─────────────────────────────────────────
  const isTimeBased = partner?.visitingCredits != null && partner.visitingCredits.type !== 'perVisit';
  const pricingType = partner?.visitingCredits?.type ?? 'perVisit';
  const unitRate = partner?.visitingCredits?.amount ?? 0;

  /** Calculate the number of units and total cost for time-based bookings */
  const getTimedBookingCost = useCallback(() => {
    if (!isTimeBased) return { units: 1, total: unitRate };

    const diffMs = scheduledEndAt.getTime() - scheduledAt.getTime();
    if (diffMs <= 0) return { units: 1, total: unitRate };

    let msPerUnit: number;
    switch (pricingType) {
      case 'perHour':
        msPerUnit = 60 * 60 * 1000;
        break;
      case 'perDay':
        msPerUnit = 24 * 60 * 60 * 1000;
        break;
      case 'perWeek':
        msPerUnit = 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        msPerUnit = 60 * 60 * 1000;
    }

    const calculatedUnits = Math.ceil(diffMs / msPerUnit);
    const units = Math.max(1, calculatedUnits);
    return { units, total: units * unitRate };
  }, [isTimeBased, scheduledAt, scheduledEndAt, pricingType, unitRate]);

  const bookingCost = getTimedBookingCost();

  // ── Offline modal handlers ───────────────────────────────────────────────────
  // ── Chat handler ───────────────────────────────────────────────────────────
  const handleChat = useCallback(() => {
    if (!partner) return;
    const charge = partner.chatCharges ?? 0;
    Alert.alert(
      'Start Chat',
      charge > 0
        ? `₹${charge} will be deducted from your wallet to chat with ${partner.fullName}.`
        : `Start a free chat with ${partner.fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: charge > 0 ? `Pay ₹${charge} & Chat` : 'Start Chat',
          onPress: async () => {
            setChatLoading(true);
            try {
              // 1. Deduct charge (or no-op if free)
              await initiateChat(partner._id);

              // 2. Get or create the conversation record
              const { data } = await getOrCreateConversation(partner._id);
              const conversationId = data.conversation._id;

              // 3. Close the sheet, then navigate into the chat room
              onClose();
              router.push({
                pathname: '/(tabs)/chat/[conversationId]' as any,
                params: {
                  conversationId,
                  partnerName: partner.fullName,
                  partnerPhoto: partner.profilePhoto ?? partner.selfieUrl ?? '',
                },
              });
            } catch (err: any) {
              const msg = err?.response?.data?.message ?? 'Could not start chat. Try again.';
              Alert.alert(
                err?.response?.data?.code === 'INSUFFICIENT_BALANCE' ? 'Insufficient Balance' : 'Error',
                msg,
              );
            } finally {
              setChatLoading(false);
            }
          },
        },
      ],
    );
  }, [partner, router, onClose]);

  // ── Call handler ───────────────────────────────────────────────────────────
  const handleCall = useCallback(() => {
    if (!partner) return;
    const charge   = partner.callCharges?.amount ?? 0;
    const duration = partner.callCharges?.durationMinutes ?? 10;
    Alert.alert(
      'Start Call',
      charge > 0
        ? `₹${charge} will be deducted from your wallet for a ${duration}-minute call with ${partner.fullName}.`
        : `Start a free call with ${partner.fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: charge > 0 ? `Pay ₹${charge} & Call` : 'Start Call',
          onPress: async () => {
            setCallLoading(true);
            try {
              // 1. Deduct call charges from wallet (if applicable)
              if (charge > 0) {
                const res = await initiateCall(partner._id);
                setCallDuration(res.durationMinutes);
                onCallPaid?.(partner._id, res.durationMinutes);
              }

              // 2. Initiate the actual real-time call via LiveKit
              //    The parent handles connecting to LiveKit and showing CallScreen
              onClose();
              onCallInitiate?.(partner);
            } catch (err: any) {
              const msg = err?.response?.data?.message ?? 'Could not initiate call. Try again.';
              Alert.alert(
                err?.response?.data?.code === 'INSUFFICIENT_BALANCE' ? 'Insufficient Balance' : 'Error',
                msg,
              );
            } finally {
              setCallLoading(false);
            }
          },
        },
      ],
    );
  }, [partner, onCallPaid, onCallInitiate, onClose]);

  // ── Book handler ───────────────────────────────────────────────────────────
  const handleBook = useCallback(async () => {
    if (!partner) return;

    if (scheduledAt <= new Date()) {
      Alert.alert('Invalid Date', 'Please select a future date and time.');
      return;
    }

    // For time-based bookings, validate end time
    if (isTimeBased && scheduledEndAt <= scheduledAt) {
      Alert.alert('Invalid End Time', 'End time must be after start time.');
      return;
    }

    // If partner is offline, show the offline modal
    if (!partner.isOnline || !partner.isAvailable) {
      if (!partner.emergencyAvailable) {
        setOfflineModalType('no_emergency');
      } else {
        setOfflineModalType('emergency_available');
      }
      return;
    }

    // Partner is online — proceed normally
    const ok = await book(partner, {
      scheduledAt,
      scheduledEndAt: isTimeBased ? scheduledEndAt : undefined,
      description: description.trim() || undefined,
      isEmergency,
    });

    if (ok) {
      onBooked();
      onClose();
    }
  }, [partner, scheduledAt, scheduledEndAt, isTimeBased, description, isEmergency, book, onBooked, onClose]);

  // Handle emergency booking confirmation from modal
  const handleConfirmEmergency = useCallback(async () => {
    if (!partner) return;

    setEmergencyBooking(true);
    const ok = await book(partner, {
      scheduledAt,
      scheduledEndAt: isTimeBased ? scheduledEndAt : undefined,
      description: description.trim() || undefined,
      isEmergency: true,
    });
    setEmergencyBooking(false);

    if (ok) {
      setOfflineModalType('success');
    }
  }, [partner, scheduledAt, scheduledEndAt, isTimeBased, description, book]);

  const handleOfflineModalClose = useCallback(() => {
    const wasSuccess = offlineModalType === 'success';
    setOfflineModalType(null);
    if (wasSuccess) {
      onBooked();
      onClose();
    }
  }, [offlineModalType, onBooked, onClose]);

  if (!partner) return null;

  const avatarUri = partner.selfieUrl
    ?? partner.profilePhoto
    ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.fullName)}&background=12493B&color=fff&size=300`;

  const primaryCategory = partner.categories[0]?.name ?? 'General';

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Dimmed backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Partner hero ─────────────────────────────────────────────── */}
            {(!partner.isOnline || !partner.isAvailable) && (
              <View style={styles.offlineBanner}>
                <Ionicons name="moon-outline" size={16} color="#92400E" />
                <Text style={styles.offlineBannerText}>
                  {partner.emergencyAvailable
                    ? 'This partner is currently offline. Emergency booking available.'
                    : 'This partner is currently offline and not accepting bookings.'}
                </Text>
              </View>
            )}
            <View style={styles.hero}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />

              <Text style={styles.partnerName}>{partner.fullName}</Text>
              <Text style={styles.partnerCategory}>{primaryCategory}</Text>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Ionicons name="star" size={14} color={colors.star} />
                  <Text style={styles.statValue}>
                    {partner.averageRating > 0 ? partner.averageRating.toFixed(1) : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={styles.statValue}>{partner.completedJobs ?? 0}</Text>
                  <Text style={styles.statLabel}>Jobs Done</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Ionicons name="location" size={14} color={colors.primary} />
                  <Text style={styles.statValue}>
                    {displayDistanceKm != null
                      ? formatDistance(displayDistanceKm)
                      : `${partner.distanceKm.toFixed(1)} km`}
                  </Text>
                  <Text style={styles.statLabel}>Away</Text>
                </View>
              </View>
            </View>

            {/* ── About + Categories ──────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              {partner.bio ? (
                <Text style={styles.bioText}>{partner.bio}</Text>
              ) : (
                <Text style={styles.bioText}>No bio provided.</Text>
              )}
            </View>

            {/* ── Chips ────────────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>
              <View style={styles.chipRow}>
                {partner.visitingCredits != null && (
                  <InfoChip
                    icon="wallet-outline"
                    label={`₹${partner.visitingCredits.amount} / ${
                      { perVisit: 'visit', perHour: 'hr', perDay: 'day', perWeek: 'week' }[partner.visitingCredits.type]
                    }`}
                  />
                )}
                {partner.experience != null && partner.experience > 0 && (
                  <InfoChip icon="time-outline" label={`${partner.experience} yr exp`} />
                )}
                {partner.emergencyAvailable && (
                  <InfoChip icon="flash-outline" label="Emergency available" />
                )}
                {partner.languages?.map((lang) => (
                  <InfoChip key={lang} icon="chatbubble-outline" label={lang} />
                ))}
                {/* Category – Subcategory chips */}
                {partner.categories.map((cat) => {
                  // find which subcategories this partner selected under this category
                  const selectedSubs = (partner.subcategories ?? [])
                    .filter((s) => s.categoryId === cat._id)
                    .map((s) =>
                      cat.subcategories?.find((sub) => sub._id === s.subcategoryId)
                    )
                    .filter(Boolean) as { _id: string; name: string }[];

                  if (selectedSubs.length === 0) {
                    // No subcategory — show category alone
                    return (
                      <InfoChip key={cat._id} icon="briefcase-outline" label={cat.name} />
                    );
                  }
                  return selectedSubs.map((sub) => (
                    <InfoChip
                      key={`${cat._id}-${sub._id}`}
                      icon="briefcase-outline"
                      label={`${cat.name} – ${sub.name}`}
                    />
                  ));
                })}
              </View>
            </View>

            {/* ── Booking form ─────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isTimeBased ? 'Schedule (Start Time)' : 'Schedule'}
              </Text>

              {/* Date & time picker trigger */}
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    setShowDatePicker(true);
                  } else {
                    setShowDatePicker(true);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.dateBtnText}>{formatDate(scheduledAt)}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Android: separate Date + Time pickers */}
              {showDatePicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="date"
                  minimumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                />
              )}
              {showTimePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="time"
                  display="default"
                  onChange={handleTimeChange}
                />
              )}
              {/* iOS inline time picker shown together */}
              {showDatePicker && Platform.OS === 'ios' && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                />
              )}
            </View>

            {/* ── End Time (only for time-based pricing) ──────────────────── */}
            {isTimeBased && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>End Time</Text>

                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowEndDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                  <Text style={styles.dateBtnText}>{formatDate(scheduledEndAt)}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                {showEndDatePicker && (
                  <DateTimePicker
                    value={scheduledEndAt}
                    mode="date"
                    minimumDate={scheduledAt}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleEndDateChange}
                  />
                )}
                {showEndTimePicker && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={scheduledEndAt}
                    mode="time"
                    display="default"
                    onChange={handleEndTimeChange}
                  />
                )}
                {showEndDatePicker && Platform.OS === 'ios' && (
                  <DateTimePicker
                    value={scheduledEndAt}
                    mode="time"
                    display="spinner"
                    onChange={handleEndTimeChange}
                  />
                )}

                {/* ── Price breakdown ─────────────────────────────────────── */}
                <View style={styles.priceBreakdown}>
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.priceBreakdownLabel}>Rate</Text>
                    <Text style={styles.priceBreakdownValue}>
                      ₹{unitRate} / {{ perHour: 'hr', perDay: 'day', perWeek: 'wk' }[pricingType] ?? 'unit'}
                    </Text>
                  </View>
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.priceBreakdownLabel}>Duration</Text>
                    <Text style={styles.priceBreakdownValue}>
                      {bookingCost.units} {{ perHour: 'hr', perDay: 'day', perWeek: 'wk' }[pricingType] ?? 'unit'}
                      {bookingCost.units > 1 ? 's' : ''}
                    </Text>
                  </View>
                  {bookingCost.units === 1 && scheduledEndAt > scheduledAt && (
                    <View style={styles.minChargeNote}>
                      <Ionicons name="information-circle-outline" size={13} color="#D97706" />
                      <Text style={styles.minChargeNoteText}>
                        Minimum charge: 1 {{ perHour: 'hour', perDay: 'day', perWeek: 'week' }[pricingType] ?? 'unit'}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.priceBreakdownRow, styles.priceTotalRow]}>
                    <Text style={styles.priceTotalLabel}>Total</Text>
                    <Text style={styles.priceTotalValue}>₹{bookingCost.total}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Describe your requirement…"
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Emergency toggle */}
            {partner.emergencyAvailable && (
              <TouchableOpacity
                style={styles.emergencyRow}
                onPress={() => setIsEmergency((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, isEmergency && styles.checkboxChecked]}>
                  {isEmergency && <Ionicons name="checkmark" size={14} color={colors.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emergencyLabel}>Emergency Booking</Text>
                  <Text style={styles.emergencyNote}>Mark this as an urgent request</Text>
                </View>
                <Ionicons name="flash-outline" size={18} color={isEmergency ? '#EF4444' : colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Error message */}
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Call duration banner — shown after a successful call deduction */}
            {callDuration != null && (
              <View style={styles.callDurationBanner}>
                <Ionicons name="time" size={15} color="#1E40AF" />
                <Text style={styles.callDurationText}>
                  Call unlocked · {callDuration} min
                </Text>
              </View>
            )}
          </ScrollView>

          {/* ── Book Now CTA ─────────────────────────────────────────────────── */}
          <View style={styles.footer}>
            {/* Chat + Call row */}
            <View style={styles.commsRow}>
              <TouchableOpacity
                style={styles.commsBtn}
                onPress={handleChat}
                disabled={chatLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${partner.fullName}`}
              >
                {chatLoading ? (
                  <ActivityIndicator size={14} color={colors.primary} />
                ) : (
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                )}
                <Text style={styles.commsBtnText}>
                  {partner.chatCharges && partner.chatCharges > 0
                    ? `Chat · ₹${partner.chatCharges}`
                    : 'Chat'}
                </Text>
              </TouchableOpacity>

              <View style={styles.commsDivider} />

              <TouchableOpacity
                style={styles.commsBtn}
                onPress={handleCall}
                disabled={callLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Call ${partner.fullName}`}
              >
                {callLoading ? (
                  <ActivityIndicator size={14} color="#1E40AF" />
                ) : (
                  <Ionicons name="call-outline" size={16} color="#1E40AF" />
                )}
                <Text style={[styles.commsBtnText, styles.callBtnText]}>
                  {partner.callCharges?.amount && partner.callCharges.amount > 0
                    ? `Call · ₹${partner.callCharges.amount}/${partner.callCharges.durationMinutes}min`
                    : 'Call'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Book row */}
            <View style={styles.bookRow}>
              {partner.visitingCredits != null && (
                <View style={styles.priceLabel}>
                  <Text style={styles.priceLabelText}>
                    {isTimeBased
                      ? `${bookingCost.units} {{ perHour: 'hr', perDay: 'day', perWeek: 'wk' }[pricingType] ?? 'unit'}${bookingCost.units > 1 ? 's' : ''}`
                      : { perVisit: 'Per visit', perHour: 'Per hour', perDay: 'Per day', perWeek: 'Per week' }[partner.visitingCredits.type]}
                  </Text>
                  <Text style={styles.priceValue}>₹{isTimeBased ? bookingCost.total : partner.visitingCredits.amount}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.bookBtn, booking && styles.bookBtnDisabled, (!partner.isOnline || !partner.isAvailable) && styles.bookBtnEmergency]}
                onPress={handleBook}
                disabled={booking}
                activeOpacity={0.85}
              >
                {booking ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={(!partner.isOnline || !partner.isAvailable) ? 'flash-outline' : 'checkmark-circle-outline'}
                      size={20}
                      color={colors.white}
                    />
                    <Text style={styles.bookBtnText}>Book Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
      <Toast />
    </Modal>

    {/* ── Offline Partner Modal ─────────────────────────────────────────────── */}
    <OfflineBookingModal
      type={offlineModalType}
      partnerName={partner.fullName}
      loading={emergencyBooking}
      onClose={handleOfflineModalClose}
      onConfirmEmergency={handleConfirmEmergency}
    />
    </>
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
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEF3C7',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: '#E5E7EB',
  },
  partnerName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  partnerCategory: {
    ...typography.caption,
    fontSize: 13,
    textAlign: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },

  // Sections
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bioText: {
    ...typography.body,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  skillTag: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skillText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },

  // Date button
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  dateBtnText: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },

  // Description
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 80,
  },

  // Emergency toggle
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF5F5',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  emergencyLabel: {
    ...typography.body,
    fontWeight: '600',
    color: '#991B1B',
  },
  emergencyNote: {
    ...typography.caption,
    color: '#EF4444',
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#EF4444',
  },

  // Footer
  footer: {
    flexDirection: 'column',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 0,
  },
  priceLabel: {
    gap: 2,
  },
  priceLabelText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
  },
  bookBtnDisabled: {
    opacity: 0.6,
  },
  bookBtnEmergency: {
    backgroundColor: '#DC2626',
  },
  bookBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Communication ──────────────────────────────────────────────────────────
  callDurationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  callDurationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  commsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#EBEBF0',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  commsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  commsDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#EBEBF0',
  },
  commsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  callBtnText: {
    color: '#1E40AF',
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Price breakdown (time-based bookings)
  priceBreakdown: {
    marginTop: spacing.md,
    backgroundColor: '#F0FDF4',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  priceBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceBreakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  priceBreakdownValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  priceTotalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
  },
  priceTotalLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  priceTotalValue: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  minChargeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: 2,
  },
  minChargeNoteText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '500',
  },
});
