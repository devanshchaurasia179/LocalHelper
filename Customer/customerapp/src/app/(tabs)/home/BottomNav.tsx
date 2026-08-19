import { memo, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { NavRoute } from './types';
import { colors, spacing, radii } from './theme';

const EASE = Easing.bezier(0.4, 0, 0.2, 1);
const ANIM_DURATION = 220;

const NAV_ITEMS: {
  route: NavRoute;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { route: 'home',     icon: 'home-outline',                activeIcon: 'home',              label: 'Home'     },
  { route: 'bookings', icon: 'calendar-outline',            activeIcon: 'calendar',          label: 'Bookings' },
  { route: 'chat',     icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses', label: 'Chat'   },
  { route: 'wallet',   icon: 'wallet-outline',              activeIcon: 'wallet',            label: 'Wallet'   },
  { route: 'profile',  icon: 'person-outline',              activeIcon: 'person',            label: 'Profile'  },
];

function getActiveRoute(pathname: string): NavRoute {
  const segment = pathname.split('/')[1] || '';
  for (const item of NAV_ITEMS) {
    if (segment === item.route) return item.route;
  }
  return 'home';
}

interface BottomNavProps {
  onNavigate: (route: NavRoute) => void;
}

const NavItem = memo(function NavItem({
  item,
  isActive,
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
  onNavigate: (route: NavRoute) => void;
}) {
  const progress = useSharedValue(isActive ? 1 : 0);

  useAnimatedReaction(
    () => isActive,
    (active, prev) => {
      if (active !== prev) {
        progress.value = withTiming(active ? 1 : 0, {
          duration: ANIM_DURATION,
          easing: EASE,
        });
      }
    },
    [isActive]
  );

  // Background pill opacity — no layout change, just opacity
  const bgStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  // Label: fade + slight slide — no layout impact
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 1], [0, 1], 'clamp'),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-8, 0]) },
      { scale: interpolate(progress.value, [0.4, 1], [0.8, 1], 'clamp') },
    ],
  }));

  const handlePress = useCallback(() => {
    onNavigate(item.route);
  }, [item.route, onNavigate]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
    >
      <View style={styles.pill}>
        {/* Background — absolutely positioned, animates opacity only */}
        <Animated.View style={[styles.pillBg, bgStyle]} />

        {/* Icon — always rendered, never animated */}
        <View style={styles.iconWrapper}>
          <Ionicons
            name={isActive ? item.activeIcon : item.icon}
            size={22}
            color={isActive ? colors.white : colors.navInactive}
          />
        </View>

        {/* Label — always rendered (avoids mount/unmount jitter), hidden via opacity */}
        <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
          {item.label}
        </Animated.Text>
      </View>
    </Pressable>
  );
});

export default function BottomNav({ onNavigate }: BottomNavProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const activeRoute = useMemo(() => getActiveRoute(pathname), [pathname]);
  const bottomOffset = Math.max(insets.bottom + 12, 16);

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
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
    bottom: 16,
    left: '5%',
    right: '5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pill: {
    height: 44,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 6,
    overflow: 'hidden',
  },
  // Absolutely positioned background — animates opacity only (GPU composited)
  pillBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  iconWrapper: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontFamily: 'Jost_600SemiBold',
    color: colors.white,
    fontSize: 13,
    zIndex: 1,
  },
});
