import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashColors, DashSpacing, DashType, DashRadius, NAV_HEIGHT } from '../theme';
import { NavItem } from '../types';

interface BottomNavProps {
  items: NavItem[];
  activeKey: string;
  onPress: (key: string) => void;
}

export function BottomNav({ items, activeKey, onPress }: BottomNavProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + DashSpacing.sm }]}>
      <View style={styles.pill}>
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.navItem}
              onPress={() => onPress(item.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
            >
              {/* Active item gets a filled indicator behind the icon */}
              {isActive && <View style={styles.activeIndicator} />}

              <Ionicons
                name={(isActive ? item.iconActive : item.icon) as any}
                size={22}
                color={isActive ? DashColors.navActive : DashColors.navInactive}
              />
              <Text
                style={[
                  styles.label,
                  isActive ? styles.labelActive : styles.labelInactive,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: DashSpacing.base,
    right: DashSpacing.base,
    // No extra top so the pill sits flush
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: DashColors.navBackground,
    borderRadius: DashRadius.xl,
    height: NAV_HEIGHT,
    alignItems: 'center',
    paddingHorizontal: DashSpacing.sm,
    // Shadow
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: DashSpacing.xs,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 36,
    height: 4,
    borderBottomLeftRadius: DashRadius.sm,
    borderBottomRightRadius: DashRadius.sm,
    backgroundColor: DashColors.navActive,
  },
  label: {
    fontSize: DashType.xs,
    fontWeight: '600',
  },
  labelActive: {
    color: DashColors.navActive,
  },
  labelInactive: {
    color: DashColors.navInactive,
  },
});
