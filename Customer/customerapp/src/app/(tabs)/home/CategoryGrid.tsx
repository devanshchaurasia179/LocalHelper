import { useEffect } from 'react';
import { View, Text, ImageBackground, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { colors, spacing, radii, typography } from './theme';
import type { NearbyCategory } from '@/api/nearby.api';

// ─── Category → local image map ───────────────────────────────────────────────
// Add new entries as more images land in assets/images

const CATEGORY_IMAGES: Record<string, number> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  carpenter:   require('../../../../assets/images/Carpenter.png') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  driver:      require('../../../../assets/images/Driver.png') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plumber:     require('../../../../assets/images/Plumber.png') as number,
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FALLBACK_IMAGE = require('../../../../assets/images/Fallback.png') as number;

function getCategoryImage(name: string): number {
  return CATEGORY_IMAGES[name.trim().toLowerCase()] ?? FALLBACK_IMAGE;
}

// ─── Category → icon map ──────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  plumber:     'water-outline',
  carpenter:   'hammer-outline',
  driver:      'car-outline',
  electrician: 'flash-outline',
  cleaner:     'sparkles-outline',
  painter:     'brush-outline',
  mechanic:    'construct-outline',
  gardener:    'leaf-outline',
  cook:        'restaurant-outline',
  mover:       'cube-outline',
};

function getCategoryIcon(name: string): keyof typeof Ionicons.glyphMap {
  return CATEGORY_ICONS[name.trim().toLowerCase()] ?? 'briefcase-outline';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryGridProps {
  categories: NearbyCategory[];
  onCategoryPress: (category: NearbyCategory) => void;
}

// ─── Single card ──────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  onPress,
}: {
  category: NearbyCategory;
  onPress: () => void;
}) {
  const image = getCategoryImage(category.name);
  const icon  = getCategoryIcon(category.name);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const handlePress = () => {
    // Let the press-in animation render first, then navigate
    // This eliminates the visual "freeze" between tap and transition
    requestAnimationFrame(() => {
      onPress();
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${category.name} services`}
    >
      <Animated.View style={[styles.card, animStyle]}>
        {/* Photo background */}
        <ImageBackground
          source={image}
          style={styles.imageBg}
          imageStyle={styles.imageStyle}
          resizeMode="cover"
        >
          {/* Dark gradient scrim — bottom-heavy so text pops */}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.08)',
              'rgba(0,0,0,0.30)',
              'rgba(0,0,0,0.72)',
            ]}
            locations={[0, 0.45, 1]}
            style={styles.scrim}
          >
            {/* Icon pill — top-left */}
            <View style={styles.iconPill}>
              <Ionicons name={icon} size={15} color={colors.white} />
            </View>

            {/* "Available" badge — top-right */}
            <View style={styles.availBadge}>
              <View style={styles.availDot} />
              <Text style={styles.availText}>Available</Text>
            </View>

            {/* Label area — bottom */}
            <View style={styles.labelArea}>
              <Text style={styles.catName} numberOfLines={1}>
                {category.name}
              </Text>
              <View style={styles.arrowPill}>
                <Ionicons name="arrow-forward" size={12} color={colors.white} />
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </Animated.View>
    </Pressable>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export default function CategoryGrid({ categories, onCategoryPress }: CategoryGridProps) {
  return (
    <View style={styles.grid}>
      {categories.map((cat) => (
        <CategoryCard
          key={cat._id}
          category={cat}
          onPress={() => onCategoryPress(cat)}
        />
      ))}
    </View>
  );
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-160, 160]) }],
  }));

  return (
    <View style={[styles.cell, styles.skeletonCard]}>
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.30)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function CategoryGridSkeleton() {
  return (
    <View style={styles.grid}>
      {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_HEIGHT = 150;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  cell: {
    width: '47.5%',
  },

  // ── Card shell (shadow lives here, outside the overflow:hidden ImageBg)
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    height: CARD_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 7,
  },

  // ── ImageBackground fills the card shell
  imageBg: {
    flex: 1,
  },
  imageStyle: {
    borderRadius: radii.lg,
  },

  // ── Gradient scrim fills ImageBackground, lays out children
  scrim: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },

  // Top row: icon pill + available badge
  iconPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  availBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  availDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  availText: {
    fontFamily: 'Jost_500Medium',
    fontSize: 10,
    color: colors.white,
  },

  // Bottom row: category name + arrow
  labelArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catName: {
    fontFamily: 'Jost_600SemiBold',
    fontSize: 15,
    color: colors.white,
    flex: 1,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  arrowPill: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Skeleton
  skeletonCard: {
    height: CARD_HEIGHT,
    borderRadius: radii.lg,
    backgroundColor: '#D1D5DB',
    overflow: 'hidden',
  },
});
