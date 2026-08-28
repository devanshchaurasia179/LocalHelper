import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, fonts, typography } from './theme';
import type { NearbyCategory } from '@/api/nearby.api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterValues {
  subcategoryIds: string[];
  onlineOnly: boolean;
  maxDistance: number | null;
}

interface FilterDropdownProps {
  visible: boolean;
  onClose: () => void;
  categories: NearbyCategory[];
  /** subcategoryId -> number of available partners offering it */
  subcategoryPartnerCounts: Map<string, number>;
  activeFilters: FilterValues;
  onApply: (filters: FilterValues) => void;
}

// ─── Distance presets ─────────────────────────────────────────────────────────

const DISTANCE_OPTIONS = [
  { label: 'Any', value: null },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function FilterDropdown({
  visible,
  onClose,
  categories,
  subcategoryPartnerCounts,
  activeFilters,
  onApply,
}: FilterDropdownProps) {
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    activeFilters.subcategoryIds
  );
  const [onlineOnly, setOnlineOnly] = useState(activeFilters.onlineOnly);
  const [maxDistance, setMaxDistance] = useState<number | null>(activeFilters.maxDistance);

  // Cap the card at 85% of the screen so it can never overflow, but otherwise
  // let it size to its content so short lists show everything without scrolling.
  const { height: windowHeight } = useWindowDimensions();

  // Flatten subcategories across the available categories (de-duplicated),
  // keeping ONLY subcategories that at least one available partner offers.
  const subcategories = (() => {
    const seen = new Set<string>();
    const result: { _id: string; name: string; image?: { url?: string } }[] = [];
    for (const cat of categories) {
      for (const sub of cat.subcategories ?? []) {
        const hasPartners = (subcategoryPartnerCounts.get(sub._id) ?? 0) > 0;
        if (hasPartners && !seen.has(sub._id)) {
          seen.add(sub._id);
          result.push({ _id: sub._id, name: sub.name, image: sub.image });
        }
      }
    }
    return result;
  })();

  // Sync local draft when modal becomes visible
  useEffect(() => {
    if (visible) {
      setSelectedSubcategories(activeFilters.subcategoryIds);
      setOnlineOnly(activeFilters.onlineOnly);
      setMaxDistance(activeFilters.maxDistance);
    }
  }, [visible, activeFilters]);

  const toggleSubcategory = (id: string) => {
    setSelectedSubcategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleReset = () => {
    // Clear the local draft AND apply immediately so the user doesn't have to
    // press "Apply filter" after resetting.
    setSelectedSubcategories([]);
    setOnlineOnly(false);
    setMaxDistance(null);
    onApply({
      subcategoryIds: [],
      onlineOnly: false,
      maxDistance: null,
    });
  };

  const handleApply = () => {
    onApply({
      subcategoryIds: selectedSubcategories,
      onlineOnly,
      maxDistance,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.card, { maxHeight: windowHeight * 0.85 }]}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
                nestedScrollEnabled2
              >
                {/* ── Subcategory filter ── */}
                <Text style={styles.sectionTitle}>Available Services</Text>
                {subcategories.length === 0 ? (
                  <Text style={styles.emptyHint}>No partners available nearby right now.</Text>
                ) : (
                <View style={styles.chipRow}>
                  {subcategories.map((sub) => {
                    const isSelected = selectedSubcategories.includes(sub._id);
                    return (
                      <Pressable
                        key={sub._id}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => toggleSubcategory(sub._id)}
                      >
                        {sub.image?.url ? (
                          <Image
                            source={{ uri: sub.image.url }}
                            style={styles.chipImage}
                            resizeMode="cover"
                          />
                        ) : null}
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {sub.name}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={12} color={colors.white} />}
                      </Pressable>
                    );
                  })}
                </View>
                )}

                {/* ── Distance filter ── */}
                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Distance</Text>
                <View style={styles.chipRow}>
                  {DISTANCE_OPTIONS.map((opt) => {
                    const isSelected = maxDistance === opt.value;
                    return (
                      <Pressable
                        key={opt.label}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => setMaxDistance(opt.value)}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* ── Availability toggle ── */}
                <Pressable
                  style={styles.toggleRow}
                  onPress={() => setOnlineOnly((v) => !v)}
                >
                  <Text style={styles.toggleLabel}>Online only</Text>
                  <View style={[styles.toggleSwitch, onlineOnly && styles.toggleSwitchOn]}>
                    <View style={[styles.toggleKnob, onlineOnly && styles.toggleKnobOn]} />
                  </View>
                </Pressable>
              </ScrollView>

              {/* ── Footer ── */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
                  <Text style={styles.resetBtnText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.8}>
                  <Text style={styles.applyBtnText}>Apply filter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },

  // ── Section ──
  sectionTitle: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: colors.navInactive,
  },

  // ── Chips ──
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.white,
  },

  // ── Toggle ──
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    fontFamily: fonts.jostMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  toggleSwitch: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchOn: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  resetBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 14,
    color: colors.primary,
  },
  applyBtn: {
    flex: 2,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 14,
    color: colors.white,
  },
});
