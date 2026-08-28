import { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, radii, fonts, typography } from './theme';
import type { NearbyCategory } from '@/api/nearby.api';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SearchDropdownProps {
  visible: boolean;
  onClose: () => void;
  categories: NearbyCategory[];
  partnerCounts: Map<string, number>;
}

// ─── Icon fallback ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'home service': 'hammer-outline',
  'cleaning service': 'sparkles-outline',
  'appliance service': 'construct-outline',
  'pest control': 'bug-outline',
  'beauty & wellness': 'flower-outline',
};

function getCategoryIcon(name: string): keyof typeof Ionicons.glyphMap {
  return CATEGORY_ICONS[name.trim().toLowerCase()] ?? 'briefcase-outline';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchDropdown({
  visible,
  onClose,
  categories,
  partnerCounts,
}: SearchDropdownProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Auto-focus when modal opens, reset on close
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setQuery('');
    }
  }, [visible]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { matches: [] as SearchResult[], hasQuery: false };

    const matches: SearchResult[] = [];

    for (const cat of categories) {
      for (const sub of cat.subcategories ?? []) {
        if (sub.name.toLowerCase().includes(q)) {
          const count = partnerCounts.get(sub._id) ?? 0;
          matches.push({
            categoryId: cat._id,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            subcategoryId: sub._id,
            subcategoryName: sub.name,
            partnerCount: count,
            isAvailable: count > 0,
          });
        }
      }
      if (cat.name.toLowerCase().includes(q)) {
        const alreadyCovered = matches.some((m) => m.categoryId === cat._id);
        if (!alreadyCovered) {
          const totalPartners = (cat.subcategories ?? []).reduce(
            (sum, sub) => sum + (partnerCounts.get(sub._id) ?? 0),
            0
          );
          matches.push({
            categoryId: cat._id,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            subcategoryId: undefined,
            subcategoryName: undefined,
            partnerCount: totalPartners,
            isAvailable: totalPartners > 0,
          });
        }
      }
    }

    return { matches, hasQuery: true };
  }, [query, categories, partnerCounts]);

  const handleResultPress = (result: SearchResult) => {
    Keyboard.dismiss();
    onClose();
    if (result.subcategoryId) {
      router.push({
        pathname: '/(tabs)/nearby/[categoryId]',
        params: {
          categoryId: result.categoryId,
          categoryName: result.categoryName,
          subcategoryId: result.subcategoryId,
          subcategoryName: result.subcategoryName,
        },
      } as any);
    } else {
      router.push({
        pathname: '/(tabs)/nearby/[categoryId]',
        params: {
          categoryId: result.categoryId,
          categoryName: result.categoryName,
        },
      } as any);
    }
  };

  const noResults = searchResults.hasQuery && searchResults.matches.length === 0;

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
            <View style={styles.card}>
              {/* ── Search input inside the modal ── */}
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <TextInput
                  ref={inputRef}
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search services (e.g. Plumber)"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Results ── */}
              {!searchResults.hasQuery && (
                <View style={styles.hintContainer}>
                  <Ionicons name="search-outline" size={36} color={colors.navInactive} />
                  <Text style={styles.hintText}>
                    Type to search for a service
                  </Text>
                </View>
              )}

              {noResults && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="location-outline" size={36} color={colors.navInactive} />
                  <Text style={styles.emptyTitle}>Not Available</Text>
                  <Text style={styles.emptyText}>
                    "{query.trim()}" is not available at your current location
                  </Text>
                </View>
              )}

              {searchResults.hasQuery && searchResults.matches.length > 0 && (
                <ScrollView
                  style={styles.resultsList}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {searchResults.matches.map((result) => (
                    <Pressable
                      key={`${result.categoryId}-${result.subcategoryId ?? 'cat'}`}
                      style={styles.resultItem}
                      onPress={() => handleResultPress(result)}
                      android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
                    >
                      <View style={styles.resultIconCircle}>
                        {result.categoryIcon ? (
                          <MaterialCommunityIcons
                            name={result.categoryIcon as any}
                            size={18}
                            color={colors.primary}
                          />
                        ) : (
                          <Ionicons
                            name={getCategoryIcon(result.categoryName)}
                            size={18}
                            color={colors.primary}
                          />
                        )}
                      </View>
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName} numberOfLines={1}>
                          {result.subcategoryName ?? result.categoryName}
                        </Text>
                        <Text style={styles.resultCategory} numberOfLines={1}>
                          {result.subcategoryName ? result.categoryName : 'Category'}
                        </Text>
                      </View>
                      {result.isAvailable ? (
                        <View style={styles.availableBadge}>
                          <Text style={styles.availableBadgeText}>
                            {result.partnerCount} nearby
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.unavailableBadge}>
                          <Text style={styles.unavailableBadgeText}>Not available</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  partnerCount: number;
  isAvailable: boolean;
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
    maxHeight: 420,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },

  // ── Search input row ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },

  // ── Hint (no query yet) ──
  hintContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  hintText: {
    ...typography.caption,
    textAlign: 'center',
  },

  // ── Empty state ──
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl + 8,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  emptyText: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Results list ──
  resultsList: {
    maxHeight: 320,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  resultIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(22, 73, 60, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  resultCategory: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // ── Badges ──
  availableBadge: {
    backgroundColor: 'rgba(22, 73, 60, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  availableBadgeText: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    color: colors.primary,
  },
  unavailableBadge: {
    backgroundColor: '#FFF3F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  unavailableBadgeText: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    color: '#E53935',
  },
});
