import { useState, useCallback, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { colors, spacing, radii, fonts } from '../home/theme';
import BottomNav from '../home/BottomNav';
import { NavRoute } from '../home/types';
import { ROUTES } from '@/constants/routes';

// ─── Theme accents ─────────────────────────────────────────────────────────────
const HERO = colors.primary;        // green hero band
const ACCENT = colors.primary;      // toggle / active accent
const HERO_TEXT = '#FFFFFF';
const SURFACE = colors.surface;
const DIVIDER = 'rgba(0,0,0,0.06)';
const DANGER = '#EF4444';

// ─── Constants ────────────────────────────────────────────────────────────────
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

const EMPTY_ADDRESS_FORM = {
  label: '', house: '', street: '', locality: '',
  city: '', state: '', pincode: '',
};

// Per-row icon tints — softer than a single solid green everywhere.
type Tint = { fg: string; bg: string };
const TINT = {
  green:  { fg: HERO,      bg: `${HERO}14` },
  blue:   { fg: '#2563EB', bg: '#2563EB14' },
  amber:  { fg: '#B45309', bg: '#B4530914' },
  rose:   { fg: '#BE123C', bg: '#BE123C14' },
  slate:  { fg: '#475569', bg: '#47556914' },
  violet: { fg: '#7C3AED', bg: '#7C3AED14' },
} satisfies Record<string, Tint>;

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

function formatAddressLine(addr?: {
  house?: string; street?: string; locality?: string;
  city?: string; state?: string; pincode?: string;
}): string {
  if (!addr) return '';
  return [addr.house, addr.street, addr.locality, addr.city]
    .filter(Boolean)
    .join(', ');
}

// ─── Menu row ─────────────────────────────────────────────────────────────────
function MenuRow({
  icon, tint = TINT.green, label, subtitle, onPress, showChevron = true, trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint?: Tint;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <Pressable
      style={({ pressed }) => [menuStyles.row, pressed && onPress && menuStyles.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
    >
      <View style={[menuStyles.iconBox, { backgroundColor: tint.bg }]}>
        <Ionicons name={icon} size={18} color={tint.fg} />
      </View>
      <View style={menuStyles.textWrap}>
        <Text style={menuStyles.label} numberOfLines={1}>{label}</Text>
        {!!subtitle && <Text style={menuStyles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {trailing}
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.navInactive} />
      )}
    </Pressable>
  );
}

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 14,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    marginHorizontal: -6,
  },
  rowPressed: { backgroundColor: 'rgba(0,0,0,0.035)' },
  iconBox: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  label: { fontFamily: fonts.jakartaSemiBold, fontSize: 14.5, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});

// ─── Profile Screen ───────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { customer, updateProfile, updateAddress, signOut } = useAuth();
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

  const [editName,   setEditName]   = useState(customer?.name   ?? '');
  const [editGender, setEditGender] = useState(customer?.gender ?? '');

  // Address edit state
  const [addrFormVisible,    setAddrFormVisible]    = useState(false);
  const [addrSaving,         setAddrSaving]         = useState(false);
  const [editingAddressId,   setEditingAddressId]   = useState<string | null>(null);
  const [addrForm,           setAddrForm]           = useState(EMPTY_ADDRESS_FORM);

  const setAddrField = (field: keyof typeof EMPTY_ADDRESS_FORM) => (val: string) =>
    setAddrForm((prev) => ({ ...prev, [field]: val }));

  const openAddressEdit = useCallback((addr: NonNullable<typeof customer>['addresses'][number]) => {
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
      Alert.alert('Missing fields', 'City, State, and Pincode are required.'); return;
    }
    if (!/^\d{6}$/.test(addrForm.pincode.trim())) {
      Alert.alert('Invalid pincode', 'Pincode must be exactly 6 digits.'); return;
    }
    if (!editingAddressId) {
      Alert.alert('Error', 'Cannot identify address to update.'); return;
    }
    setAddrSaving(true);
    try {
      const location = await getCoordsSilently();
      await updateAddress(editingAddressId, {
        label:    addrForm.label.trim()    || 'Home',
        house:    addrForm.house.trim(),
        street:   addrForm.street.trim(),
        locality: addrForm.locality.trim(),
        city:     addrForm.city.trim(),
        state:    addrForm.state.trim(),
        pincode:  addrForm.pincode.trim(),
      }, location ?? undefined);
      setAddrFormVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not update address.');
    } finally {
      setAddrSaving(false);
    }
  }, [addrForm, editingAddressId, updateAddress]);

  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === 'profile') return; // Already here
    if (route === 'home')     router.navigate(ROUTES.APP.HOME     as any);
    if (route === 'bookings') router.navigate(ROUTES.APP.BOOKINGS as any);
    if (route === 'wallet')   router.navigate(ROUTES.APP.WALLET   as any);
    if (route === 'chat')     router.navigate(ROUTES.APP.CHAT     as any);
  }, []);

  const handleSave = useCallback(async () => {
    if (editName.trim().length < 2) {
      Alert.alert('Name too short', 'Please enter at least 2 characters.'); return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: editName.trim(), gender: editGender || undefined });
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [editName, editGender, updateProfile]);

  const handleCancelEdit = useCallback(() => {
    setEditName(customer?.name ?? '');
    setEditGender(customer?.gender ?? '');
    setEditing(false);
  }, [customer]);

  const openEdit = useCallback(() => {
    setEditName(customer?.name ?? '');
    setEditGender(customer?.gender ?? '');
    setEditing(true);
  }, [customer]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
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
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const primaryAddress = customer?.addresses?.[0];
  const city = primaryAddress?.city ?? 'Location not set';
  const state = primaryAddress?.state ?? '';
  const locationLabel = state ? `${city}, ${state}` : city;
  const hasAddress = !!primaryAddress;
  const addressSubtitle = hasAddress
    ? (formatAddressLine(primaryAddress) || `${city}${state ? `, ${state}` : ''}`)
    : 'Add your address';
  const genderLabel = customer?.gender ? customer.gender : 'Not set';

  const openSavedAddresses = useCallback(() => {
    if (primaryAddress) openAddressEdit(primaryAddress);
    else router.navigate(ROUTES.APP.HOME as any);
  }, [primaryAddress, openAddressEdit]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero banner ─────────────────────────────────────────────── */}
          <View style={s.hero}>
            {/* Top bar */}
            <View style={s.topBar}>
              <Pressable
                style={({ pressed }) => [s.iconBtn, pressed && s.iconBtnPressed]}
                onPress={() => router.back()}
                accessibilityRole="button" accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={20} color={HERO} />
              </Pressable>
              <Text style={s.heroTitle}>My Profile</Text>
              <Pressable
                style={({ pressed }) => [s.iconBtn, pressed && s.iconBtnPressed]}
                onPress={openEdit}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="pencil" size={16} color={HERO} />
              </Pressable>
            </View>

            {/* Avatar sits on the curve boundary */}
            <View style={s.avatarWrap}>
              <View style={s.avatarRing}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Name + verified + location ───────────────────────────────── */}
          <View style={s.identity}>
            <View style={s.nameRow}>
              <Text style={s.userName}>{customer?.name ?? '—'}</Text>
              {customer?.phoneVerified && (
                <Ionicons name="checkmark-circle" size={18} color={HERO} />
              )}
            </View>

            <View style={s.locationRow}>
              <Ionicons name="location-sharp" size={13} color={colors.textSecondary} />
              <Text style={s.locationText} numberOfLines={1}>{locationLabel}</Text>
            </View>

            {/* Quick chips */}
            <View style={s.chipsRow}>
              <View style={s.infoChip}>
                <Ionicons name="call-outline" size={12} color={HERO} />
                <Text style={s.infoChipText}>{customer?.phone ?? '—'}</Text>
              </View>
              {customer?.phoneVerified && (
                <View style={[s.infoChip, s.verifiedChip]}>
                  <Ionicons name="shield-checkmark" size={12} color={HERO} />
                  <Text style={s.infoChipText}>Verified</Text>
                </View>
              )}
            </View>
          </View>

          {/* ════════════════ ACCOUNT ════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionHeading}>Account</Text>
            <View style={s.menuCard}>
              <MenuRow
                icon="person-outline" tint={TINT.green}
                label="Personal Data"
                subtitle={genderLabel === 'Not set' ? 'Name, gender' : genderLabel}
                onPress={openEdit}
              />
              <View style={s.divider} />
              <MenuRow
                icon="location-outline" tint={TINT.blue}
                label="Saved Address"
                subtitle={addressSubtitle}
                onPress={openSavedAddresses}
              />
              <View style={s.divider} />
              <MenuRow
                icon="ban-outline" tint={TINT.rose}
                label="Blocked Partners"
                onPress={() => router.push('/(tabs)/profile/blocked-partners' as any)}
              />
            </View>
          </View>

          {/* ════════════════ PREFERENCES ════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionHeading}>Preferences</Text>
            <View style={s.menuCard}>
              <MenuRow
                icon="notifications-outline" tint={TINT.amber}
                label="Push Notifications"
                subtitle={notifEnabled ? 'On' : 'Off'}
                showChevron={false}
                trailing={
                  <Switch
                    value={notifEnabled}
                    onValueChange={setNotifEnabled}
                    trackColor={{ false: '#D1D1DB', true: ACCENT }}
                    thumbColor={HERO_TEXT}
                    accessibilityLabel="Toggle notifications"
                  />
                }
              />
              <View style={s.divider} />
              <MenuRow
                icon="settings-outline" tint={TINT.slate}
                label="Settings"
                onPress={() => Alert.alert('Settings', 'Coming soon')}
              />
            </View>
          </View>

          {/* ════════════════ SUPPORT ════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionHeading}>Support</Text>
            <View style={s.menuCard}>
              <MenuRow
                icon="chatbubble-ellipses-outline" tint={TINT.green}
                label="Contact Us"
                subtitle="support@localhelpers.app"
                onPress={() => Alert.alert('Contact Us', 'support@localhelpers.app')}
              />
              <View style={s.divider} />
              <MenuRow
                icon="document-text-outline" tint={TINT.violet}
                label="Privacy Policy"
                onPress={() => Alert.alert('Privacy Policy', 'Coming soon')}
              />
            </View>
          </View>

          {/* ── Sign out ─────────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [s.signOutBtn, pressed && { opacity: 0.75 }]}
            onPress={handleSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            {signingOut ? (
              <ActivityIndicator color={DANGER} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={18} color={DANGER} />
                <Text style={s.signOutText}>Sign out</Text>
              </>
            )}
          </Pressable>
        </ScrollView>

        <BottomNav onNavigate={handleNavigate} />
      </KeyboardAvoidingView>

      {/* ════════════════ EDIT PROFILE MODAL ════════════════ */}
      <Modal visible={editing} transparent animationType="slide" onRequestClose={handleCancelEdit}>
        <KeyboardAvoidingView style={modal.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={modal.backdrop} onPress={handleCancelEdit}>
            <Pressable style={modal.sheet} onPress={() => {}}>
              <View style={modal.handle} />
              <View style={modal.headerRow}>
                <Text style={modal.title}>Edit Profile</Text>
                <TouchableOpacity onPress={handleCancelEdit} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={modal.fieldLabel}>Full name</Text>
                <TextInput
                  style={modal.input} value={editName} onChangeText={setEditName}
                  placeholder="e.g. Rahul Sharma" placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words" returnKeyType="done" accessibilityLabel="Full name"
                />
                <Text style={[modal.fieldLabel, { marginTop: spacing.md }]}>Gender</Text>
                <View style={modal.chipRow}>
                  {GENDERS.map((g) => (
                    <Pressable
                      key={g}
                      style={[modal.chip, editGender === g && modal.chipSelected]}
                      onPress={() => setEditGender(g)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: editGender === g }}
                      accessibilityLabel={g}
                    >
                      <Text style={[modal.chipText, editGender === g && modal.chipTextSelected]}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={modal.actions}>
                  <Pressable style={modal.cancelBtn} onPress={handleCancelEdit} disabled={saving} accessibilityRole="button">
                    <Text style={modal.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[modal.saveBtn, (editName.trim().length < 2 || saving) && modal.saveBtnDisabled]}
                    onPress={handleSave} disabled={editName.trim().length < 2 || saving} accessibilityRole="button"
                  >
                    {saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={modal.saveBtnText}>Save changes</Text>}
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════ EDIT ADDRESS MODAL ════════════════ */}
      <Modal visible={addrFormVisible} transparent animationType="slide" onRequestClose={() => setAddrFormVisible(false)}>
        <KeyboardAvoidingView style={addrModal.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={addrModal.backdrop} onPress={() => setAddrFormVisible(false)}>
            <Pressable style={addrModal.sheet} onPress={() => {}}>
              <View style={addrModal.handle} />
              <View style={addrModal.headerRow}>
                <Text style={addrModal.title}>Edit address</Text>
                <TouchableOpacity onPress={() => setAddrFormVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={addrModal.fieldLabel}>Label</Text>
                <View style={addrModal.chipRow}>
                  {['Home', 'Office', 'Other'].map((l) => (
                    <TouchableOpacity key={l}
                      style={[addrModal.chip, addrForm.label === l && addrModal.chipActive]}
                      onPress={() => setAddrField('label')(l)}>
                      <Text style={[addrModal.chipText, addrForm.label === l && addrModal.chipTextActive]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <AddrField label="Flat / House no." value={addrForm.house} onChangeText={setAddrField('house')} placeholder="e.g. A-204" />
                <AddrField label="Street" value={addrForm.street} onChangeText={setAddrField('street')} placeholder="e.g. MG Road" />
                <AddrField label="Locality / Area" value={addrForm.locality} onChangeText={setAddrField('locality')} placeholder="e.g. Koregaon Park" />
                <AddrField label="City *" value={addrForm.city} onChangeText={setAddrField('city')} placeholder="e.g. Pune" />
                <AddrField label="State *" value={addrForm.state} onChangeText={setAddrField('state')} placeholder="e.g. Maharashtra" />
                <AddrField label="Pincode *" value={addrForm.pincode} onChangeText={setAddrField('pincode')} placeholder="6-digit pincode" keyboardType="number-pad" maxLength={6} />
                <Pressable style={[addrModal.saveBtn, addrSaving && addrModal.saveBtnDisabled]}
                  onPress={handleAddressSave} disabled={addrSaving} accessibilityRole="button" accessibilityLabel="Update address">
                  {addrSaving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={addrModal.saveBtnText}>Update address</Text>}
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Main styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.background },
  flex:  { flex: 1 },
  scroll: { paddingBottom: 120 },

  // Hero band
  hero: {
    backgroundColor: HERO,
    paddingBottom: 52,           // extra space for avatar to overlap
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: HERO_TEXT,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  heroTitle: { fontFamily: fonts.oswaldSemiBold, fontSize: 18, color: HERO_TEXT, letterSpacing: 0.4 },

  // Avatar (centred, overlapping the curve)
  avatarWrap: { alignItems: 'center', marginTop: 4, marginBottom: -85 },
  avatarRing: {
    width: 104, height: 104, borderRadius: 52,
    borderWidth: 4, borderColor: HERO_TEXT,
    backgroundColor: HERO_TEXT,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 10, elevation: 8,
  },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${HERO}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.oswaldBold, fontSize: 34, color: HERO },

  // Identity block
  identity: { alignItems: 'center', marginTop: 62, marginBottom: spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontFamily: fonts.jakartaBold, fontSize: 22, color: colors.textPrimary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, maxWidth: 260 },

  chipsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radii.pill, backgroundColor: `${HERO}12`,
  },
  verifiedChip: { backgroundColor: `${HERO}12` },
  infoChipText: { fontFamily: fonts.jakartaMedium, fontSize: 12, color: colors.textPrimary },

  // Sections
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sectionHeading: {
    fontFamily: fonts.oswaldSemiBold, fontSize: 14, color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2,
  },
  menuCard: {
    backgroundColor: SURFACE, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  divider: { height: 1, backgroundColor: DIVIDER, marginLeft: 52 },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.lg, marginTop: spacing.xs,
    paddingVertical: spacing.md, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: '#EF444433', backgroundColor: '#FEF2F2',
  },
  signOutText: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: DANGER },
});

// ─── Edit-profile modal styles ────────────────────────────────────────────────
const modal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg, paddingTop: spacing.sm,
    paddingBottom: spacing.xl, paddingHorizontal: spacing.md, maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.jakartaBold, fontSize: 17, color: colors.textPrimary },
  fieldLabel: { fontFamily: fonts.jakartaMedium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: SURFACE, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    fontFamily: fonts.jostRegular, fontSize: 15, color: colors.textPrimary,
    borderWidth: 1.5, borderColor: '#E5E5E5',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill, borderWidth: 1.5, borderColor: '#E5E5E5', backgroundColor: SURFACE,
  },
  chipSelected: { backgroundColor: HERO, borderColor: HERO },
  chipText: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textPrimary },
  chipTextSelected: { fontFamily: fonts.jakartaSemiBold, color: colors.white },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.sm + 4, borderRadius: radii.sm,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E5E5', backgroundColor: SURFACE,
  },
  cancelBtnText: { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: spacing.sm + 4, borderRadius: radii.sm, alignItems: 'center', backgroundColor: HERO },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.white },
});

// ─── Edit-address modal styles ────────────────────────────────────────────────
const addrModal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg, paddingTop: spacing.sm,
    paddingBottom: spacing.xl, paddingHorizontal: spacing.md, maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.jakartaBold, fontSize: 17, color: colors.textPrimary },
  fieldLabel: { fontFamily: fonts.jakartaMedium, fontSize: 12, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.pill, borderWidth: 1.5, borderColor: '#DDD', backgroundColor: SURFACE },
  chipActive: { borderColor: HERO, backgroundColor: `${HERO}18` },
  chipText: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textSecondary },
  chipTextActive: { fontFamily: fonts.jakartaSemiBold, color: HERO },
  fieldWrap: { marginBottom: spacing.md },
  input: { borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textPrimary, backgroundColor: SURFACE },
  saveBtn: { backgroundColor: HERO, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: fonts.jakartaSemiBold, color: colors.white, fontSize: 15 },
});

// ─── AddrField sub-component ──────────────────────────────────────────────────
function AddrField({
  label, value, onChangeText, placeholder, keyboardType, maxLength,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'number-pad'; maxLength?: number;
}) {
  return (
    <View style={addrModal.fieldWrap}>
      <Text style={addrModal.fieldLabel}>{label}</Text>
      <TextInput
        style={addrModal.input} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType ?? 'default'} maxLength={maxLength} autoCorrect={false}
      />
    </View>
  );
}
