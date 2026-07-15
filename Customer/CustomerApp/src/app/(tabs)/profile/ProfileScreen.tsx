import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing, radii, typography } from '../home/theme';
import BottomNav from '../home/BottomNav';
import { NavRoute } from '../home/types';
import { ROUTES } from '@/constants/routes';

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

const EMPTY_ADDRESS_FORM = {
  label: '',
  house: '',
  street: '',
  locality: '',
  city: '',
  state: '',
  pincode: '',
};

// ─── Helper: silently get GPS coords ─────────────────────────────────────────

async function getCoordsSilently(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return null;
  }
}

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
  const { customer, updateProfile, updateAddress, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Editable fields — seeded from current customer data
  const [editName, setEditName] = useState(customer?.name ?? '');
  const [editGender, setEditGender] = useState(customer?.gender ?? '');

  // ── Address edit state ──────────────────────────────────────────────────────
  const [addrFormVisible, setAddrFormVisible] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState(EMPTY_ADDRESS_FORM);

  const setAddrField = (field: keyof typeof EMPTY_ADDRESS_FORM) => (val: string) =>
    setAddrForm((prev) => ({ ...prev, [field]: val }));

  const openAddressEdit = useCallback((addr: typeof customer.addresses[number]) => {
    setAddrForm({
      label:    addr.label    ?? '',
      house:    addr.house    ?? '',
      street:   addr.street   ?? '',
      locality: addr.locality ?? '',
      city:     addr.city,
      state:    addr.state,
      pincode:  addr.pincode,
    });
    setEditingAddressId((addr as any)._id ?? null);
    setAddrFormVisible(true);
  }, []);

  const handleAddressSave = useCallback(async () => {
    if (!addrForm.city.trim() || !addrForm.state.trim() || !addrForm.pincode.trim()) {
      Alert.alert('Missing fields', 'City, State, and Pincode are required.');
      return;
    }
    if (!/^\d{6}$/.test(addrForm.pincode.trim())) {
      Alert.alert('Invalid pincode', 'Pincode must be exactly 6 digits.');
      return;
    }
    if (!editingAddressId) {
      Alert.alert('Error', 'Cannot identify address to update.');
      return;
    }

    setAddrSaving(true);
    try {
      // Silently capture GPS — not shown to user
      const location = await getCoordsSilently();

      await updateAddress(
        editingAddressId,
        {
          label:    addrForm.label.trim()    || 'Home',
          house:    addrForm.house.trim(),
          street:   addrForm.street.trim(),
          locality: addrForm.locality.trim(),
          city:     addrForm.city.trim(),
          state:    addrForm.state.trim(),
          pincode:  addrForm.pincode.trim(),
        },
        location ?? undefined
      );
      setAddrFormVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not update address.');
    } finally {
      setAddrSaving(false);
    }
  }, [addrForm, editingAddressId, updateAddress]);

  // Navigate via BottomNav
  const handleNavigate = useCallback(
    (route: NavRoute) => {
      if (route === 'home') router.replace(ROUTES.APP.HOME as any);
    },
    [],
  );

  // Save name/gender edit — persists to backend
  const handleSave = useCallback(async () => {
    if (editName.trim().length < 2) {
      Alert.alert('Name too short', 'Please enter at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: editName.trim(), gender: editGender || undefined });
      setEditing(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? 'Failed to save. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }, [editName, editGender, updateProfile]);

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
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel edit"
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.saveBtn,
                      (editName.trim().length < 2 || saving) && styles.saveBtnDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={editName.trim().length < 2 || saving}
                    accessibilityRole="button"
                    accessibilityLabel="Save changes"
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save</Text>
                    )}
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
                <View key={(addr as any)._id ?? i}>
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
                    {/* Edit address button */}
                    <TouchableOpacity
                      style={styles.addrEditBtn}
                      onPress={() => openAddressEdit(addr)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${addr.label ?? 'address'}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
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

      {/* ════════════════════════════════════════════════════════════════════
          EDIT ADDRESS MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={addrFormVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddrFormVisible(false)}
      >
        <KeyboardAvoidingView
          style={addrStyles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={addrStyles.backdrop} onPress={() => setAddrFormVisible(false)}>
            <Pressable style={addrStyles.sheet} onPress={() => {}}>
              {/* drag handle */}
              <View style={addrStyles.handle} />

              {/* Header row */}
              <View style={addrStyles.headerRow}>
                <Text style={addrStyles.title}>Edit address</Text>
                <TouchableOpacity onPress={() => setAddrFormVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Label chips */}
                <Text style={addrStyles.fieldLabel}>Label</Text>
                <View style={addrStyles.chipRow}>
                  {['Home', 'Office', 'Other'].map((l) => (
                    <TouchableOpacity
                      key={l}
                      style={[addrStyles.chip, addrForm.label === l && addrStyles.chipActive]}
                      onPress={() => setAddrField('label')(l)}
                    >
                      <Text style={[addrStyles.chipText, addrForm.label === l && addrStyles.chipTextActive]}>
                        {l}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <AddrField label="Flat / House no." value={addrForm.house} onChangeText={setAddrField('house')} placeholder="e.g. A-204" />
                <AddrField label="Street" value={addrForm.street} onChangeText={setAddrField('street')} placeholder="e.g. MG Road" />
                <AddrField label="Locality / Area" value={addrForm.locality} onChangeText={setAddrField('locality')} placeholder="e.g. Koregaon Park" />
                <AddrField label="City *" value={addrForm.city} onChangeText={setAddrField('city')} placeholder="e.g. Pune" />
                <AddrField label="State *" value={addrForm.state} onChangeText={setAddrField('state')} placeholder="e.g. Maharashtra" />
                <AddrField
                  label="Pincode *"
                  value={addrForm.pincode}
                  onChangeText={setAddrField('pincode')}
                  placeholder="6-digit pincode"
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <Pressable
                  style={[addrStyles.saveBtn, addrSaving && addrStyles.saveBtnDisabled]}
                  onPress={handleAddressSave}
                  disabled={addrSaving}
                  accessibilityRole="button"
                  accessibilityLabel="Update address"
                >
                  {addrSaving ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={addrStyles.saveBtnText}>Update address</Text>
                  )}
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
    alignItems: 'center',
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
  addrEditBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: `${colors.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
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

// ─── AddrField sub-component (for edit address modal) ────────────────────────

function AddrField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
}) {
  return (
    <View style={addrStyles.fieldWrap}>
      <Text style={addrStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={addrStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        autoCorrect={false}
      />
    </View>
  );
}

// ─── Address modal styles ─────────────────────────────────────────────────────

const addrStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#DDD',
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  fieldWrap: { marginBottom: spacing.md },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
