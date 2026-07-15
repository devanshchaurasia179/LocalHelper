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
import { colors, spacing, radii } from '../home/theme';
import BottomNav from '../home/BottomNav';
import { NavRoute } from '../home/types';
import { ROUTES } from '@/constants/routes';

// ─── Theme accent (keeps green primary, uses it as our hero colour) ────────────
const HERO = colors.primary;        // #12493B  — green hero band
const ACCENT = colors.primary;      // icon / toggle accent
const HERO_TEXT = '#FFFFFF';
const SURFACE = '#F7F7FB';
const DIVIDER = 'rgba(0,0,0,0.07)';

// ─── Constants ────────────────────────────────────────────────────────────────
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

const EMPTY_ADDRESS_FORM = {
  label: '', house: '', street: '', locality: '',
  city: '', state: '', pincode: '',
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

function formatAddress(addr: {
  label?: string; house?: string; street?: string;
  locality?: string; city: string; state: string; pincode: string;
}) {
  const parts = [addr.house, addr.street, addr.locality, addr.city].filter(Boolean).join(', ');
  return `${parts} — ${addr.state} ${addr.pincode}`;
}

// ─── Menu row ─────────────────────────────────────────────────────────────────
function MenuRow({
  icon, label, onPress, showChevron = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  return (
    <TouchableOpacity
      style={menuStyles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={menuStyles.iconBox}>
        <Ionicons name={icon} size={18} color={HERO_TEXT} />
      </View>
      <Text style={menuStyles.label}>{label}</Text>
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
}

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 14,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
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
    if (route === 'home')     router.replace(ROUTES.APP.HOME     as any);
    if (route === 'bookings') router.replace(ROUTES.APP.BOOKINGS as any);
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

  const city = customer?.addresses?.[0]?.city ?? 'Location not set';
  const state = customer?.addresses?.[0]?.state ?? '';
  const locationLabel = state ? `${city}, ${state}` : city;

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
              <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}
                accessibilityRole="button" accessibilityLabel="Go back">
                <Ionicons name="chevron-back" size={20} color={HERO} />
              </TouchableOpacity>
              <Text style={s.heroTitle}>Profile</Text>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => setEditing(true)}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="pencil-outline" size={18} color={HERO} />
              </TouchableOpacity>
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

          {/* ── Name + location ──────────────────────────────────────────── */}
          <View style={s.identity}>
            <Text style={s.userName}>{customer?.name ?? '—'}</Text>
            <View style={s.locationRow}>
              <View style={s.locationDot} />
              <Text style={s.locationText}>{locationLabel}</Text>
            </View>
          </View>

          {/* ════════════════════════════════════════════════════════════
              ACCOUNT section
          ════════════════════════════════════════════════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionHeading}>Account</Text>
            <View style={s.menuCard}>
              <MenuRow icon="person-outline" label="Personal Data" onPress={() => setEditing(true)} />
              <View style={s.divider} />
              <MenuRow icon="home-outline" label="Saved Addresses" onPress={() => {
                if (customer?.addresses?.length) openAddressEdit(customer.addresses[0]);
              }} />
              <View style={s.divider} />
              <MenuRow
                icon={customer?.phoneVerified ? 'shield-checkmark-outline' : 'shield-outline'}
                label={`Phone: ${customer?.phone ?? '—'}`}
                showChevron={false}
              />
            </View>
          </View>

          {/* ════════════════════════════════════════════════════════════
              NOTIFICATION section
          ════════════════════════════════════════════════════════════ */}
          <View style={s.section}>
            <View style={s.notifHeader}>
              <Text style={s.sectionHeading}>Notifications</Text>
              <Switch
                value={notifEnabled}
                onValueChange={setNotifEnabled}
                trackColor={{ false: '#ccc', true: ACCENT }}
                thumbColor={HERO_TEXT}
                accessibilityLabel="Toggle notifications"
              />
            </View>
            <View style={s.menuCard}>
              <MenuRow icon="chatbubble-ellipses-outline" label="Contact Us" onPress={() => Alert.alert('Contact Us', 'support@localhelpers.app')} />
              <View style={s.divider} />
              <MenuRow icon="document-text-outline" label="Privacy Policy" onPress={() => Alert.alert('Privacy Policy', 'Coming soon')} />
              <View style={s.divider} />
              <MenuRow icon="settings-outline" label="Settings" onPress={() => Alert.alert('Settings', 'Coming soon')} />
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
              <ActivityIndicator color="#EF4444" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                <Text style={s.signOutText}>Sign out</Text>
              </>
            )}
          </Pressable>
        </ScrollView>

        <BottomNav onNavigate={handleNavigate} />
      </KeyboardAvoidingView>

      {/* ════════════════════════════════════════════════════════════════════
          EDIT PROFILE MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editing} transparent animationType="slide" onRequestClose={handleCancelEdit}>
        <KeyboardAvoidingView style={modal.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={modal.backdrop} onPress={handleCancelEdit}>
            <Pressable style={modal.sheet} onPress={() => {}}>
              <View style={modal.handle} />
              <View style={modal.headerRow}>
                <Text style={modal.title}>Edit Profile</Text>
                <TouchableOpacity onPress={handleCancelEdit}>
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
                    {saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={modal.saveBtnText}>Save</Text>}
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          EDIT ADDRESS MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <Modal visible={addrFormVisible} transparent animationType="slide" onRequestClose={() => setAddrFormVisible(false)}>
        <KeyboardAvoidingView style={addrModal.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={addrModal.backdrop} onPress={() => setAddrFormVisible(false)}>
            <Pressable style={addrModal.sheet} onPress={() => {}}>
              <View style={addrModal.handle} />
              <View style={addrModal.headerRow}>
                <Text style={addrModal.title}>Edit address</Text>
                <TouchableOpacity onPress={() => setAddrFormVisible(false)}>
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
  heroTitle: { fontSize: 18, fontWeight: '700', color: HERO_TEXT },

  // Avatar (centred, overlapping the curve)
  avatarWrap: { alignItems: 'center', marginTop: 4, marginBottom: -85 },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 4, borderColor: HERO_TEXT,
    backgroundColor: HERO_TEXT,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    // subtle shadow
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6,
  },
  avatar: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: `${HERO}22`,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: HERO },

  // Identity block
  identity: { alignItems: 'center', marginTop: 60, marginBottom: spacing.lg },
  userName: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textSecondary },
  locationText: { fontSize: 13, color: colors.textSecondary },

  // Sections
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sectionHeading: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  menuCard: {
    backgroundColor: SURFACE, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: 4,
  },
  divider: { height: 1, backgroundColor: DIVIDER, marginLeft: 50 },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.lg,
    paddingVertical: spacing.md, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: '#EF444440', backgroundColor: '#FEF2F2',
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
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
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: SURFACE, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    fontSize: 15, color: colors.textPrimary,
    borderWidth: 1.5, borderColor: '#E5E5E5',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill, borderWidth: 1.5, borderColor: '#E5E5E5', backgroundColor: SURFACE,
  },
  chipSelected: { backgroundColor: HERO, borderColor: HERO },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.sm + 4, borderRadius: radii.sm,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E5E5', backgroundColor: SURFACE,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: spacing.sm + 4, borderRadius: radii.sm, alignItems: 'center', backgroundColor: HERO },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
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
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.pill, borderWidth: 1.5, borderColor: '#DDD', backgroundColor: SURFACE },
  chipActive: { borderColor: HERO, backgroundColor: `${HERO}18` },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: HERO, fontWeight: '700' },
  fieldWrap: { marginBottom: spacing.md },
  input: { borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.textPrimary, backgroundColor: SURFACE },
  saveBtn: { backgroundColor: HERO, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
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
