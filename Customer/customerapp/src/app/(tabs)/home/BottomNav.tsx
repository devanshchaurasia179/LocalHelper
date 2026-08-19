import { memo, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavRoute } from './types';
import { colors, spacing, radii } from './theme';
import { Text } from 'react-native';

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
      <View style={[styles.pill, isActive && styles.pillActive]}>
        <Ionicons
          name={isActive ? item.activeIcon : item.icon}
          size={20}
          color={isActive ? colors.white : colors.navInactive}
        />
        {isActive && (
          <Text style={styles.label}>{item.label}</Text>
        )}
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
    left: spacing.md,
    right: spacing.md,
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
    height: 40,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontFamily: 'Jost_600SemiBold',
    color: colors.white,
    fontSize: 12,
  },
});
