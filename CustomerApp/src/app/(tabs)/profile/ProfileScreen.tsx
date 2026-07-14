import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing, radii, typography } from '../home/theme';
import BottomNav from '../home/BottomNav';
import { NavRoute } from '../home/types';
import { ROUTES } from '@/constants/routes';

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAddress(addr: {
  label?: string;
  house?: string;
  street?: string;
  locality?: string;
  city: string;
  state: string;
  pincode: string;
}) {
  const parts = [addr.house, addr.street, addr.locality, addr.city]
    .filter(Boolean)
    .join(', ');
  return `${parts} — ${addr.state} ${addr.pincode}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={infoStyles.row} accessibilityLabel={`${label}: ${value}`}>
      <View style={infoStyles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={infoStyles.textWrap}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: `${colors.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  label: { fontSize: 11, color: colors.textSecondary, marginBottom: 1 },
  value: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
});

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { customer, patchCustomer, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Editable fields — seeded from current customer data
  const [editName, setEditName] = useState(customer?.name ?? '');
  const [editGender, setEditGender] = useState(customer?.gender ?? '');

  // Navigate via BottomNav
  const handleNavigate = useCallback(
    (route: NavRoute) => {
      if (route === 'home') router.replace(ROUTES.APP.HOME as any);
    },
    [],
  );

  // Save inline name/gender edit
  const handleSave = useCallback(() => {
    if (editName.trim().length < 2) {
      Alert.alert('Name too short', 'Please enter at least 2 characters.');
      return;
    }
    // Optimistic local update; swap with a real API call when ready
    patchCustomer({ name: editName.trim(), gender: editGender || null });
    setEditing(false);
  }, [editName, editGender, patchCustomer]);

  const handleCancelEdit = useCallback(() => {
    setEditName(customer?.name ?? '');
    setEditGender(customer?.gender ?? '');
    setEditing(false);
  }, [customer]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
            router.replace(ROUTES.AUTH.SEND_OTP as any);
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }, [signOut]);

  const initials = (customer?.name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ──────────────────────────────────────────────── */}
          <View style={styles.headerRow}>
            <Text style={styles.screenTitle}>Profile</Text>
            {!editing && (
              <Pressable
                style={styles.editBtn}
                onPress={() => setEditing(true)}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            )}
          </View>

          {/* ── Avatar card ─────────────────────────────────────────── */}
          <View style={styles.avatarCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarName} numberOfLines={1}>
                {customer?.name ?? '—'}
              </Text>
              <Text style={styles.avatarPhone}>{customer?.phone}</Text>
            </View>
          </View>

          {/* ── Personal info ───────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal info</Text>

            {editing ? (
              <View style={styles.editSection}>
                {/* Name field */}
                <Text style={styles.fieldLabel}>Full name</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                  returnKeyType="done"
                  accessibilityLabel="Full name"
                />

                {/* Gender chips */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                  Gender
                </Text>
                <View style={styles.chipRow}>
                  {GENDERS.map((g) => (
                    <Pressable
                      key={g}
                      style={[
                        styles.chip,
                        editGender === g && styles.chipSelected,
                      ]}
                      onPress={() => setEditGender(g)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: editGender === g }}
                      accessibilityLabel={g}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          editGender === g && styles.chipTextSelected,
                        ]}
                      >
                        {g}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Action buttons */}
                <View style={styles.editActions}>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={handleCancelEdit}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel edit"
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.saveBtn,
                      editName.trim().length < 2 && styles.saveBtnDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={editName.trim().length < 2}
                    accessibilityRole="button"
                    accessibilityLabel="Save changes"
                  >
                    <Text style={styles.saveBtnText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.infoList}>
                <InfoRow
                  icon="call-outline"
                  label="Phone"
                  value={customer?.phone ?? '—'}
                />
                <View style={styles.divider} />
                <InfoRow
                  icon="person-outline"
                  label="Name"
                  value={customer?.name ?? 'Not set'}
                />
                <View style={styles.divider} />
                <InfoRow
                  icon={
                    customer?.gender === 'Male'
                      ? 'male-outline'
                      : customer?.gender === 'Female'
                      ? 'female-outline'
                      : 'transgender-outline'
                  }
                  label="Gender"
                  value={customer?.gender ?? 'Not set'}
                />
              </View>
            )}
          </View>

          {/* ── Addresses ───────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Saved addresses</Text>

            {customer?.addresses && customer.addresses.length > 0 ? (
              customer.addresses.map((addr, i) => (
                <View key={i}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.addressRow}>
                    <View style={styles.addressIconWrap}>
                      <Ionicons
                        name={
                          addr.label?.toLowerCase() === 'work'
                            ? 'briefcase-outline'
                            : 'home-outline'
                        }
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.addressTextWrap}>
                      <Text style={styles.addressLabel}>
                        {addr.label ?? 'Address'}
                      </Text>
                      <Text style={styles.addressValue}>
                        {formatAddress(addr)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No addresses saved yet.</Text>
            )}
          </View>

          {/* ── Account section ─────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.infoList}>
              <InfoRow
                icon={
                  customer?.phoneVerified
                    ? 'shield-checkmark-outline'
                    : 'shield-outline'
                }
                label="Phone verification"
                value={customer?.phoneVerified ? 'Verified' : 'Not verified'}
              />
            </View>
          </View>

          {/* ── Sign out ────────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [
              styles.signOutBtn,
              pressed && { opacity: 0.75 },
            ]}
            onPress={handleSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            {signingOut ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                <Text style={styles.signOutText}>Sign out</Text>
              </>
            )}
          </Pressable>
        </ScrollView>

        <BottomNav onNavigate={handleNavigate} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 120, // clear BottomNav
    gap: spacing.md,
  },

  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  screenTitle: {
    ...typography.heading,
    fontSize: 26,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: `${colors.primary}14`,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // Avatar card
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    fontFamily: 'Oswald_700Bold',
  },
  avatarInfo: { flex: 1 },
  avatarName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    fontFamily: 'Oswald_700Bold',
  },
  avatarPhone: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  infoList: { gap: 0 },
  divider: {
    height: 1,
    backgroundColor: `${colors.textSecondary}18`,
    marginVertical: 2,
  },

  // Address rows
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  addressIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: `${colors.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  addressTextWrap: { flex: 1 },
  addressLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 1,
    textTransform: 'capitalize',
  },
  addressValue: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
  },

  // Inline edit
  editSection: { gap: spacing.sm },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: `${colors.textSecondary}30`,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: `${colors.textSecondary}40`,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.white,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: radii.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: `${colors.textSecondary}30`,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: radii.sm,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#EF444440',
    backgroundColor: '#FEF2F2',
    marginTop: spacing.xs,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
});
