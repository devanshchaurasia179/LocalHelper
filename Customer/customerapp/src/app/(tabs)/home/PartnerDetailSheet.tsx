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
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';

import { colors, spacing, radii, typography } from './theme';
import { useBookPartner } from '@/hooks/useBookPartner';
import type { NearbyPartner } from '@/api/nearby.api';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PartnerDetailSheetProps {
  partner: NearbyPartner | null;
  visible: boolean;
  onClose: () => void;
  onBooked: () => void;
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
}: PartnerDetailSheetProps) {
  const { booking, error, book, reset } = useBookPartner();

  // ── Distance (recalculated from live GPS when sheet opens) ─────────────────
  const [displayDistanceKm, setDisplayDistanceKm] = useState<number | null>(null);

  useEffect(() => {
    if (!visible || !partner) {
      setDisplayDistanceKm(null);
      return;
    }

    // Start with the server-computed value immediately so there's no blank
    setDisplayDistanceKm(partner.distanceKm);

    // Then try to get a fresh reading from device GPS
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const partnerCoords = partner.serviceLocation?.coordinates;
        if (!partnerCoords || partnerCoords.length < 2) return;

        // GeoJSON order: [longitude, latitude]
        const [partnerLng, partnerLat] = partnerCoords;
        const km = haversineKm(
          pos.coords.latitude,
          pos.coords.longitude,
          partnerLat,
          partnerLng,
        );
        setDisplayDistanceKm(km);
      } catch {
        // Silently fall back to server value
      }
    })();
  }, [visible, partner]);

  // ── Form state ─────────────────────────────────────────────────────────────
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [scheduledAt, setScheduledAt] = useState<Date>(tomorrow);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  // Reset form when sheet opens with a new partner
  useEffect(() => {
    if (visible) {
      reset();
      setScheduledAt(new Date(Date.now() + 24 * 60 * 60 * 1000));
      setDescription('');
      setIsEmergency(false);
      setShowDatePicker(false);
      setShowTimePicker(false);
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

  const handleBook = useCallback(async () => {
    if (!partner) return;

    if (scheduledAt <= new Date()) {
      Alert.alert('Invalid Date', 'Please select a future date and time.');
      return;
    }

    const ok = await book(partner, {
      scheduledAt,
      description: description.trim() || undefined,
      isEmergency,
    });

    if (ok) {
      Alert.alert(
        'Booking Confirmed 🎉',
        `Your booking with ${partner.fullName} has been placed successfully.`,
        [{ text: 'OK', onPress: () => { onBooked(); onClose(); } }]
      );
    }
  }, [partner, scheduledAt, description, isEmergency, book, onBooked, onClose]);

  if (!partner) return null;

  const avatarUri = partner.profilePhoto
    ? partner.profilePhoto
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.fullName)}&background=12493B&color=fff&size=300`;

  const primaryCategory = partner.categories[0]?.name ?? 'General';

  return (
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

            {/* ── About ────────────────────────────────────────────────────── */}
            {partner.bio ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bioText}>{partner.bio}</Text>
              </View>
            ) : null}

            {/* ── Chips ────────────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>
              <View style={styles.chipRow}>
                {partner.visitingCredits != null && (
                  <InfoChip icon="wallet-outline" label={`₹${partner.visitingCredits} visit fee`} />
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
                {partner.categories.map((cat) => (
                  <InfoChip key={cat._id} icon="briefcase-outline" label={cat.name} />
                ))}
              </View>
            </View>

            {/* ── Skills ───────────────────────────────────────────────────── */}
            {partner.skills?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Skills</Text>
                <View style={styles.chipRow}>
                  {partner.skills.map((skill) => (
                    <View key={skill} style={styles.skillTag}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Working days ─────────────────────────────────────────────── */}
            {partner.workingDays?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Available Days</Text>
                <View style={styles.chipRow}>
                  {partner.workingDays.map((entry) => (
                    <InfoChip key={entry.day} icon="calendar-outline" label={entry.day} />
                  ))}
                </View>
              </View>
            )}

            {/* ── Booking form ─────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Schedule</Text>

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
          </ScrollView>

          {/* ── Book Now CTA ─────────────────────────────────────────────────── */}
          <View style={styles.footer}>
            {partner.visitingCredits != null && (
              <View style={styles.priceLabel}>
                <Text style={styles.priceLabelText}>Visiting fee</Text>
                <Text style={styles.priceValue}>₹{partner.visitingCredits}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.bookBtn, booking && styles.bookBtnDisabled]}
              onPress={handleBook}
              disabled={booking}
              activeOpacity={0.85}
            >
              {booking ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
                  <Text style={styles.bookBtnText}>Book Now</Text>
                </>
              )}
            </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: spacing.sm,
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
  bookBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
