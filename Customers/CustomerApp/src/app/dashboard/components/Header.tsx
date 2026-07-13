import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashColors, DashSpacing, DashType, DashRadius } from '../theme';

interface HeaderProps {
  userName: string;
  /** URI for the user's avatar image */
  avatarUri: string;
  /** Number of unread notifications; 0 hides the badge */
  notificationCount?: number;
  onNotificationPress?: () => void;
  onAvatarPress?: () => void;
}

export function Header({
  userName,
  avatarUri,
  notificationCount = 0,
  onNotificationPress,
  onAvatarPress,
}: HeaderProps) {
  const firstName = userName.split(' ')[0];

  return (
    <View style={styles.row}>
      {/* Avatar */}
      <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      </TouchableOpacity>

      {/* Greeting copy */}
      <View style={styles.greetingBlock}>
        <Text style={styles.sub}>Good morning 👋</Text>
        <Text style={styles.name}>{firstName}</Text>
      </View>

      {/* Notification bell */}
      <TouchableOpacity
        onPress={onNotificationPress}
        activeOpacity={0.8}
        style={styles.bellButton}
        accessibilityLabel={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
        accessibilityRole="button"
      >
        <Ionicons name="notifications-outline" size={22} color={DashColors.textPrimary} />
        {notificationCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DashSpacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: DashRadius.full,
    backgroundColor: DashColors.border,
  },
  greetingBlock: {
    flex: 1,
  },
  sub: {
    fontSize: DashType.sm,
    color: DashColors.textSecondary,
  },
  name: {
    fontSize: DashType.md,
    fontWeight: '700',
    color: DashColors.textPrimary,
    marginTop: 1,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: DashRadius.full,
    backgroundColor: DashColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: DashRadius.full,
    backgroundColor: DashColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: DashColors.textOnPrimary,
  },
});
