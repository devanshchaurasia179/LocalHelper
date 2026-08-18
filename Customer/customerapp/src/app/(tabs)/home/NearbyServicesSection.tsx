import { useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, ImageBackground, StyleSheet, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radii, fonts } from './theme';
import type { NearbyCategory } from '@/api/nearby.api';

const SCREEN_WIDTH = Dimensions.get('window').width;
// 2 cards visible + gap + padding on both sides + room for arrow button
const HORIZONTAL_PADDING = spacing.md;
const ARROW_BUTTON_WIDTH = 36;
const GAP = spacing.sm + 2;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - ARROW_BUTTON_WIDTH - GAP) / 2;
const CARD_HEIGHT = 140;

// ─── Subcategory → local image map ───────────────────────────────────────────

const SUBCATEGORY_IMAGES: Record<string, number> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  carpenter: require('../../../../assets/images/Carpenter.png') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  driver: require('../../../../assets/images/Driver.png') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plumber: require('../../../../assets/images/Plumber.png') as number,
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FALLBACK_IMAGE = require('../../../../assets/images/Fallback.png') as number;

function getSubcategoryImage(name: string): number {
  return SUBCATEGORY_IMAGES[name.trim().toLowerCase()] ?? FALLBACK_IMAGE;
}

// ─── Icon fallback map ────────────────────────────────────────────────────────

const CATEGORY_ICONS_FALLBACK: Record<string, keyof typeof Ionicons.glyphMap> = {
  'home service': 'hammer-outline',
  'cleaning service': 'sparkles-outline',
  'appliance service': 'construct-outline',
  'pest control': 'bug-outline',
  'beauty & wellness': 'flower-outline',
  plumber: 'water-outline',
  carpenter: 'hammer-outline',
  driver: 'car-outline',
  electrician: 'flash-outline',
  cleaner: 'sparkles-outline',
  painter: 'brush-outline',
};

function getFallbackIcon(name: string): keyof typeof Ionicons.glyphMap {
  return CATEGORY_ICONS_FALLBACK[name.trim().toLowerCase()] ?? 'briefcase-outline';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NearbyServicesSectionProps {
  categories: NearbyCategory[];
  /** Map of subcategoryId → number of available partners nearby */
  partnerCounts?: Map<string, number>;
  onCategoryPress: (category: NearbyCategory) => void;
  onSubcategoryPress?: (category: NearbyCategory, subcategoryId: string, subcategoryName: string) => void;
}

// ─── Subcategory Card ─────────────────────────────────────────────────────────

function SubcategoryCard({
  name,
  partnerCount,
  onPress,
}: {
  name: string;
  partnerCount?: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const image = getSubcategoryImage(name);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.94, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <Animated.View style={[styles.subcategoryCard, animStyle]}>
        <ImageBackground
          source={image}
          style={styles.subcategoryImageBg}
          imageStyle={styles.subcategoryImageStyle}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
            locations={[0.3, 1]}
            style={styles.subcategoryScrim}
          >
            {/* Partner count badge — top right */}
            {partnerCount !== undefined && partnerCount > 0 && (
              <View style={styles.partnerCountBadge}>
                <Text style={styles.partnerCountText}>
                  {partnerCount} {partnerCount === 1 ? 'partner' : 'partners'}
                </Text>
              </View>
            )}
            <View style={styles.subcategoryBottom}>
              <Text style={styles.subcategoryName} numberOfLines={2}>
                {name}
              </Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      </Animated.View>
    </Pressable>
  );
}

// ─── Single Category Section ──────────────────────────────────────────────────

function CategorySection({
  category,
  partnerCounts,
  onCategoryPress,
  onSubcategoryPress,
}: {
  category: NearbyCategory;
  partnerCounts?: Map<string, number>;
  onCategoryPress: () => void;
  onSubcategoryPress?: (subcategoryId: string, subcategoryName: string) => void;
}) {
  const fallbackIcon = getFallbackIcon(category.name);
  const allSubcategories = category.subcategories ?? [];
  // Only show subcategories that have at least one available partner
  const subcategories = partnerCounts
    ? allSubcategories.filter((sub) => (partnerCounts.get(sub._id) ?? 0) > 0)
    : allSubcategories;
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  const handleScrollRight = () => {
    scrollOffset.current += CARD_WIDTH + GAP;
    scrollRef.current?.scrollTo({ x: scrollOffset.current, animated: true });
  };

  return (
    <View style={styles.categorySection}>
      {/* Category Title Row */}
      <Pressable
        onPress={onCategoryPress}
        style={styles.categoryHeader}
        accessibilityRole="button"
        accessibilityLabel={`View all ${category.name}`}
      >
        <View style={styles.categoryTitleRow}>
          <View style={styles.categoryIconCircle}>
            {category.icon ? (
              <MaterialCommunityIcons name={category.icon as any} size={18} color={colors.primary} />
            ) : (
              <Ionicons name={fallbackIcon} size={18} color={colors.primary} />
            )}
          </View>
          <Text style={styles.categoryName}>{category.name}</Text>
        </View>
        <View style={styles.viewAllRow}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>
      </Pressable>

      {/* Subcategory Cards — horizontal scroll with arrow */}
      {subcategories.length > 0 && (
        <View style={styles.subcategoryRow}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subcategoryScroll}
            onScroll={(e) => {
              scrollOffset.current = e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
            style={styles.subcategoryScrollView}
          >
            {subcategories.map((sub) => (
              <SubcategoryCard
                key={sub._id}
                name={sub.name}
                partnerCount={partnerCounts?.get(sub._id)}
                onPress={() => onSubcategoryPress?.(sub._id, sub.name)}
              />
            ))}
          </ScrollView>

          {/* Arrow button — only show when more than 2 subcategories */}
          {subcategories.length > 2 && (
            <Pressable
              onPress={handleScrollRight}
              style={styles.arrowButton}
              accessibilityRole="button"
              accessibilityLabel="See more subcategories"
            >
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NearbyServicesSection({
  categories,
  partnerCounts,
  onCategoryPress,
  onSubcategoryPress,
}: NearbyServicesSectionProps) {
  return (
    <View style={styles.container}>
      {categories.map((cat) => (
        <CategorySection
          key={cat._id}
          category={cat}
          partnerCounts={partnerCounts}
          onCategoryPress={() => onCategoryPress(cat)}
          onSubcategoryPress={
            onSubcategoryPress
              ? (subId, subName) => onSubcategoryPress(cat, subId, subName)
              : undefined
          }
        />
      ))}
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-200, 200]) }],
  }));

  return (
    <View style={styles.skeletonSection}>
      {/* Title skeleton */}
      <View style={styles.skeletonTitleRow}>
        <View style={styles.skeletonCircle} />
        <View style={styles.skeletonTitleBar} />
      </View>
      {/* Cards skeleton */}
      <View style={styles.skeletonCardsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonCard}>
            <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function NearbyServicesSkeleton() {
  return (
    <View style={styles.container}>
      {[0, 1, 2].map((i) => (
        <SkeletonBlock key={i} />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },

  // ── Category Section ──
  categorySection: {
    gap: spacing.sm,
  },

  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(22, 73, 60, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontFamily: fonts.jostMedium,
    fontSize: 13,
    color: colors.primary,
  },

  // ── Subcategory row with arrow ──
  subcategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subcategoryScrollView: {
    flex: 1,
  },
  subcategoryScroll: {
    paddingLeft: HORIZONTAL_PADDING,
    paddingRight: spacing.sm,
    gap: GAP,
  },
  arrowButton: {
    width: ARROW_BUTTON_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  // ── Subcategory Card ──
  subcategoryCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  subcategoryImageBg: {
    flex: 1,
  },
  subcategoryImageStyle: {
    borderRadius: radii.md,
  },
  subcategoryScrim: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  partnerCountBadge: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  partnerCountText: {
    fontFamily: fonts.jostMedium,
    fontSize: 10,
    color: colors.white,
  },
  subcategoryBottom: {
    gap: 2,
  },
  subcategoryName: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 13,
    color: colors.white,
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Skeleton ──
  skeletonSection: {
    gap: spacing.sm,
  },
  skeletonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skeletonCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0E0E0',
  },
  skeletonTitleBar: {
    width: 120,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  skeletonCardsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: GAP,
  },
  skeletonCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.md,
    backgroundColor: '#E8E8E8',
    overflow: 'hidden',
  },
});
