import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radii } from './theme';

// ─── Single shimmer bar ───────────────────────────────────────────────────────

function ShimmerBar({ width, height, style }: {
  width: number | `${number}%`;
  height: number;
  style?: object;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-200, 200]) }],
  }));

  return (
    <View style={[shimmerStyles.bar, { width, height, borderRadius: radii.sm }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const shimmerStyles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
});

// ─── Single card skeleton (mirrors ServiceCard layout) ───────────────────────

function ServiceCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Image area */}
      <ShimmerBar width="100%" height={130} style={{ borderRadius: 0 }} />

      {/* Body */}
      <View style={styles.body}>
        <ShimmerBar width="45%" height={10} />
        <ShimmerBar width="70%" height={13} style={{ marginTop: 6 }} />
        <View style={styles.priceRow}>
          <View style={{ gap: 4 }}>
            <ShimmerBar width={60} height={8} />
            <ShimmerBar width={50} height={14} />
          </View>
          <View style={styles.addBtn} />
        </View>
      </View>
    </View>
  );
}

// ─── Grid of skeletons — matches ServiceGrid's 2-column layout ───────────────

const SKELETON_COUNT = 4;

export default function ServiceGridSkeleton() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <View key={i} style={styles.cell}>
          <ServiceCardSkeleton />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cell: {
    width: '48%',
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  body: {
    padding: spacing.sm,
    paddingTop: 10,
    gap: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
});
