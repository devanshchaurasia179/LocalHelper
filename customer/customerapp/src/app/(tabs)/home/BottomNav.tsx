import { useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { NavRoute } from './types';
import { colors, spacing, radii } from './theme';

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const PILL_MIN = 52;
const PILL_MAX = 120;

const NAV_ITEMS: {
  route: NavRoute;
  matchKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { route: 'home',     matchKey: 'home',     icon: 'home-outline',       activeIcon: 'home',       label: 'Home'     },
  { route: 'bookings', matchKey: 'bookings', icon: 'calendar-outline',   activeIcon: 'calendar',   label: 'Bookings' },
  { route: 'chat',     matchKey: 'chat',     icon: 'chatbubble-outline', activeIcon: 'chatbubble', label: 'Chat'     },
  { route: 'profile',  matchKey: 'profile',  icon: 'person-outline',     activeIcon: 'person',     label: 'Profile'  },
];

interface BottomNavProps {
  onNavigate: (route: NavRoute) => void;
}

function NavItem({
  item,
  isActive,
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
  onNavigate: (route: NavRoute) => void;
}) {
  const progress = useSharedValue(isActive ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, {
      duration: isActive ? 280 : 200,
      easing: EASE,
    });
  }, [isActive]);

  // Only width — no color, no transform — clean layout animation
  const pillWidthStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [PILL_MIN, PILL_MAX]),
  }));

  // Background opacity only — separate layer, never touches icon
  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  // Label fade + slide
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.55, 1], [0, 0, 1]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [6, 0]) }],
  }));

  // Press scale
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    pressScale.value = withTiming(0.87, { duration: 80, easing: Easing.out(Easing.quad) });
  }, []);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, { stiffness: 320, damping: 14 });
  }, []);

  const handlePress = useCallback(() => {
    onNavigate(item.route);
  }, [item.route, onNavigate]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
    >
      {/* Press scale wrapper */}
      <Animated.View style={pressStyle}>
        {/* Pill width container — only animates width */}
        <Animated.View style={[styles.pill, pillWidthStyle]}>

          {/* Background color layer — absolutely positioned, never affects icon layout */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.pillBg, bgStyle]} />

          {/* Icon — plain View, no animated styles, no distortion possible */}
          <View style={styles.iconWrapper}>
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={22}
              color={isActive ? colors.white : colors.navInactive}
            />
          </View>

          {/* Label — fades in beside icon */}
          <Animated.Text
            numberOfLines={1}
            style={[styles.label, labelStyle]}
          >
            {item.label}
          </Animated.Text>

        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function BottomNav({ onNavigate }: BottomNavProps) {
  const pathname = usePathname();

  const activeRoute: NavRoute =
    NAV_ITEMS.find((item) => pathname.includes(`/${item.matchKey}`))?.route ?? 'home';

  return (
    <View style={styles.container}>
      {NAV_ITEMS.map((item) => (
        <NavItem
          key={item.route}
          item={item}
          isActive={item.route === activeRoute}
          onNavigate={onNavigate}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.lg,
    width: '90%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  pill: {
    height: 48,
    minWidth: PILL_MIN,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    gap: 6,
    overflow: 'hidden',
    // No backgroundColor here — handled by pillBg layer below
  },
  // Solid color background as its own layer — never interferes with icon rendering
  pillBg: {
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  // Plain View wrapper for icon — no animated styles, guarantees clean render
  iconWrapper: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Jost_600SemiBold',
    color: colors.white,
    fontSize: 13,
    maxWidth: 72,
  },
});
