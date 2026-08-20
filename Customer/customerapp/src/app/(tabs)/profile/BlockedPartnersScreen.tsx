/**
 * Blocked Partners Screen
 *
 * Shows list of partners the customer has blocked.
 * Allows unblocking partners with a confirmation dialog.
 * Accessible from Profile > Account > Blocked Partners.
 */
import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { useBlockedPartners } from '@/hooks/useBlockedPartners';
import { colors, spacing, radii } from '../home/theme';
import type { BlockedPartner } from '@/api/call.api';

const HERO = colors.primary;

export default function BlockedPartnersScreen() {
  const { partners, loading, refreshing, error, refresh, unblock } = useBlockedPartners();

  const handleUnblock = useCallback((partner: BlockedPartner) => {
    Alert.alert(
      'Unblock Partner',
      `Are you sure you want to unblock ${partner.fullName}? They will be able to call you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              await unblock(partner._id);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to unblock partner.');
            }
          },
        },
      ]
    );
  }, [unblock]);

  const renderPartner = useCallback(({ item }: { item: BlockedPartner }) => {
    const avatarUri = item.profilePhoto
      ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(item.fullName)}&background=16493c&color=fff&size=100`;

    return (
      <View style={s.card}>
        <Image
          source={{ uri: avatarUri }}
          style={s.avatar}
          contentFit="cover"
          transition={200}
        />
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>{item.fullName}</Text>
          {item.phone && (
            <Text style={s.phone}>{item.phone}</Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [s.unblockBtn, pressed && { opacity: 0.7 }]}
          onPress={() => handleUnblock(item)}
          accessibilityRole="button"
          accessibilityLabel={`Unblock ${item.fullName}`}
        >
          <Ionicons name="lock-open-outline" size={16} color="#EF4444" />
          <Text style={s.unblockText}>Unblock</Text>
        </Pressable>
      </View>
    );
  }, [handleUnblock]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header />
        <View style={s.center}>
          <ActivityIndicator size="large" color={HERO} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header />
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={refresh}>
            <Text style={s.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Header />
      {partners.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="shield-checkmark-outline" size={56} color={colors.textSecondary} />
          <Text style={s.emptyTitle}>No Blocked Partners</Text>
          <Text style={s.emptySubtitle}>
            Partners you block will appear here. You can unblock them anytime.
          </Text>
        </View>
      ) : (
        <FlatList
          data={partners}
          keyExtractor={(item) => item._id}
          renderItem={renderPartner}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={HERO}
              colors={[HERO]}
            />
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={s.header}>
      <Pressable
        style={s.backBtn}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={20} color={HERO} />
      </Pressable>
      <Text style={s.headerTitle}>Blocked Partners</Text>
      <View style={s.backBtn} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm + 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  phone: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: '#EF444440',
    backgroundColor: '#FEF2F2',
  },
  unblockText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginLeft: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    backgroundColor: HERO,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});
