import { useRef, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { NavRoute } from './types';
import { colors, spacing, radii } from './theme';

// Cubic bezier approximation via Easing for a smooth expand/collapse
const EASE_OUT_CUBIC = Easing.bezier(0.22, 1, 0.36, 1);
const EXPAND_MS = 300;
const COLLAPSE_MS = 220;

interface BottomNavProps {
  /** Called when the user taps a nav item. Handle navigation in the parent. */
  onNavigate: (route: NavRoute) => void;
}

const NAV_ITEMS: {
  route: NavRoute;
  matchKey: string; // leaf segment to match against the real pathname
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { route: 'home',     matchKey: 'home',     icon: 'home-outline',       activeIcon: 'home',       label: 'Home'     },
  { route: 'bookings', matchKey: 'bookings', icon: 'calendar-outline',   activeIcon: 'calendar',   label: 'Bookings' },
  { route: 'chat',     matchKey: 'chat',     icon: 'chatbubble-outline', activeIcon: 'chatbubble', label: 'Chat'     },
  { route: 'profile',  matchKey: 'profile',  icon: 'person-outline',     activeIcon: 'person',     label: 'Profile'  },
];

export default function BottomNav({ onNavigate }: BottomNavProps) {
  const pathname = usePathname();

  // expo-router strips group segments like "(tabs)" from the real pathname,
  // so we match on the leaf segment instead of the full declared route path.
  const activeRoute: NavRoute =
    (NAV_ITEMS.find((item) => pathname.includes(`/${item.matchKey}`))?.route) ?? 'home';

  // JS-driver: width + backgroundColor (can't use native driver for layout props)
  const activeAnims = useRef(
    NAV_ITEMS.reduce<Record<NavRoute, Animated.Value>>((acc, item) => {
      acc[item.route] = new Animated.Value(item.route === activeRoute ? 1 : 0);
      return acc;
    }, {} as Record<NavRoute, Animated.Value>),
  ).current;

  // Native-driver: scale on press (transform only)
  const pressAnims = useRef(
    NAV_ITEMS.reduce<Record<NavRoute, Animated.Value>>((acc, item) => {
      acc[item.route] = new Animated.Value(1);
      return acc;
    }, {} as Record<NavRoute, Animated.Value>),
  ).current;

  // Re-run whenever the active tab changes
  useEffect(() => {
    const animations = NAV_ITEMS.map(({ route }) => {
      const isExpanding = route === activeRoute;
      return Animated.timing(activeAnims[route], {
        toValue: isExpanding ? 1 : 0,
        duration: isExpanding ? EXPAND_MS : COLLAPSE_MS,
        easing: EASE_OUT_CUBIC,
        useNativeDriver: false,
      });
    });
    // Run expand + all collapses in parallel for instant feedback
    Animated.parallel(animations).start();
  }, [activeRoute]);

  const handlePressIn = useCallback((route: NavRoute) => {
    Animated.timing(pressAnims[route], {
      toValue: 0.88,
      duration: 80,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [pressAnims]);

  const handlePressOut = useCallback((route: NavRoute) => {
    Animated.spring(pressAnims[route], {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [pressAnims]);

  return (
    <View style={styles.container}>
      {NAV_ITEMS.map(({ route, icon, activeIcon, label }) => {
        const isActive = route === activeRoute;
        const anim = activeAnims[route];

        const animatedWidth = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [48, 120],
        });
        const animatedBg = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(0,0,0,0)', colors.primary],
        });
        const labelOpacity = anim.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [0, 0, 1],
        });
        const labelTranslate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        });
        const iconTranslate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -2],
        });

        return (
          <TouchableOpacity
            key={route}
            onPress={() => onNavigate(route)}
            onPressIn={() => handlePressIn(route)}
            onPressOut={() => handlePressOut(route)}
            activeOpacity={1}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            <Animated.View style={{ transform: [{ scale: pressAnims[route] }] }}>
              <Animated.View
                style={[
                  styles.item,
                  { width: animatedWidth, backgroundColor: animatedBg },
                ]}
              >
                <Animated.View style={{ transform: [{ translateX: iconTranslate }] }}>
                  <Ionicons
                    name={isActive ? activeIcon : icon}
                    size={20}
                    color={isActive ? colors.white : colors.navInactive}
                  />
                </Animated.View>

                <Animated.Text
                  numberOfLines={1}
                  style={[
                    styles.activeLabel,
                    {
                      opacity: labelOpacity,
                      transform: [{ translateX: labelTranslate }],
                      maxWidth: isActive ? 80 : 0,
                    },
                  ]}
                >
                  {label}
                </Animated.Text>
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.lg,
    width: '88%',
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
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  item: {
    height: 48,
    minWidth: 48,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  activeLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
});