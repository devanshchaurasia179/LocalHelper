import { useEffect } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

// ─── Grid geometry: exactly 3 tiles per row, equally spaced ───────────────────
// Three evenly-sized tiles per row with a consistent gap between them. The tile
// width is derived from the screen so the whole row fills the padded content
// area edge-to-edge (no leftover gap on the right).
const HORIZONTAL_PADDING = spacing.md;
const COLUMNS = 3;
const TILE_GAP = spacing.sm + spacing.xs; // 12px between tiles
const TILE_WIDTH =
  (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - TILE_GAP * (COLUMNS - 1)) / COLUMNS;
// Rectangular (landscape) image area — shorter than it is wide (~4:3) so each
// tile reads as a rectangle while the artwork still covers the full tile width.
const TILE_IMAGE_HEIGHT = Math.round(TILE_WIDTH * 0.75);

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface NearbyServicesSectionProps {
  categories: NearbyCategory[];
  /** Map of subcategoryId → number of available partners nearby */
  partnerCounts?: Map<string, number>;
  onCategoryPress: (category: NearbyCategory) => void;
  onSubcategoryPress?: (category: NearbyCategory, subcategoryId: string, subcategoryName: string) => void;
}

// ─── Subcategory Tile ─────────────────────────────────────────────────────────

function SubcategoryTile({
  name,
  imageUrl,
  onPress,
}: {
  name: string;
  /** Admin-uploaded image URL (Cloudinary) — takes priority over local assets */
  imageUrl?: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  // Prefer the admin-uploaded image; fall back to the bundled local asset.
  const image = imageUrl ? { uri: imageUrl } : getSubcategoryImage(name);

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
      style={styles.tile}
    >
      <Animated.View style={[styles.tileImageWrap, animStyle]}>
        <Image source={image} style={styles.tileImage} resizeMode="cover" />
      </Animated.View>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {name}
      </Text>
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
  const allSubcategories = category.subcategories ?? [];
  // Only show subcategories that have at least one available partner nearby
  const subcategories = partnerCounts
    ? allSubcategories.filter((sub) => (partnerCounts.get(sub._id) ?? 0) > 0)
    : allSubcategories;

  if (subcategories.length === 0) return null;

  return (
    <View style={styles.categorySection}>
      {/* Category title heading */}
      <Pressable
        onPress={onCategoryPress}
        style={styles.categoryHeader}
        accessibilityRole="button"
        accessibilityLabel={`View all ${category.name}`}
      >
        <Text style={styles.categoryName}>{category.name}</Text>
        <View style={styles.viewAllRow}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>
      </Pressable>

      {/* Subcategory tiles — grid, max 3 per row, wraps to next row */}
      <View style={styles.tileGrid}>
        {subcategories.map((sub) => (
          <SubcategoryTile
            key={sub._id}
            name={sub.name}
            imageUrl={sub.image?.url}
            onPress={() => onSubcategoryPress?.(sub._id, sub.name)}
          />
        ))}
      </View>
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
      <View style={styles.skeletonTitleBar} />
      {/* Tile grid skeleton */}
      <View style={styles.tileGrid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.skeletonTile}>
            <View style={styles.skeletonTileImage}>
              <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
            <View style={styles.skeletonTileLabel} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function NearbyServicesSkeleton() {
  return (
    <View style={styles.container}>
      {[0, 1].map((i) => (
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
    gap: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  categoryName: {
    fontFamily: fonts.jakartaBold,
    fontSize: 18,
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

  // ── Tile grid (exactly 3 per row, equally spaced) ──
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: HORIZONTAL_PADDING,
    columnGap: TILE_GAP,
    rowGap: spacing.md,
  },

  // ── Subcategory tile ──
  tile: {
    width: TILE_WIDTH,
    alignItems: 'center',
  },
  tileImageWrap: {
    alignSelf: 'stretch', // fill the full tile width so the image always covers
    height: TILE_IMAGE_HEIGHT,
    borderRadius: radii.sm + 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileLabel: {
    marginTop: spacing.xs + 2,
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // ── Skeleton ──
  skeletonSection: {
    gap: spacing.md,
  },
  skeletonTitleBar: {
    width: 150,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: HORIZONTAL_PADDING,
  },
  skeletonTile: {
    width: TILE_WIDTH,
    alignItems: 'center',
  },
  skeletonTileImage: {
    width: TILE_WIDTH,
    height: TILE_IMAGE_HEIGHT,
    borderRadius: radii.sm + 2,
    backgroundColor: '#E8E8E8',
    overflow: 'hidden',
  },
  skeletonTileLabel: {
    marginTop: spacing.xs + 2,
    width: TILE_WIDTH * 0.75,
    height: 10,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
});
