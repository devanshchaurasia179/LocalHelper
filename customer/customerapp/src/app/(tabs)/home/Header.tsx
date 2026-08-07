import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';
import { colors, spacing, radii, typography, fonts } from './theme';
import { useAuth } from '@/providers/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Address {
  _id?: string;
  label?: string;
  house?: string;
  street?: string;
  locality?: string;
  city: string;
  state: string;
  pincode: string;
}

interface HeaderProps {
  addresses: Address[];
  selectedIndex: number;
  onSelectAddress: (index: number) => void;
  hasNotification?: boolean;
  onNotificationPress?: () => void;
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const EMPTY_FORM = {
  label: '',
  house: '',
  street: '',
  locality: '',
  city: '',
  state: '',
  pincode: '',
};

type FormMode = 'add' | 'edit';

// ─── Places helpers (same pattern as onboarding/index.tsx) ───────────────────

const MAPS_KEY: string = process.env.EXPO_PUBLIC_MAPS_KEY ?? '';

type PlaceSuggestion = {
  place_id: string;
  description: string;
  structured_formatting: { main_text: string; secondary_text: string };
};

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

function newSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function fetchSuggestions(
  input: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  const { data } = await axios.get(
    'https://maps.googleapis.com/maps/api/place/autocomplete/json',
    {
      params: {
        input,
        key: MAPS_KEY,
        language: 'en',
        components: 'country:in',
        sessiontoken: sessionToken,
      },
    },
  );
  if (__DEV__ && data.status !== 'OK')
    console.warn('[Places]', data.status, data.error_message);
  return data.status === 'OK' ? data.predictions : [];
}

async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<{ components: AddressComponent[] } | null> {
  const { data } = await axios.get(
    'https://maps.googleapis.com/maps/api/place/details/json',
    {
      params: {
        place_id: placeId,
        fields: 'address_components',
        key: MAPS_KEY,
        sessiontoken: sessionToken,
      },
    },
  );
  if (data.status !== 'OK') return null;
  return { components: data.result.address_components ?? [] };
}

function getComponent(
  components: AddressComponent[],
  type: string,
  form: 'long_name' | 'short_name' = 'long_name',
): string {
  return components.find((c) => c.types.includes(type))?.[form] ?? '';
}

// ─── PlacesInput (inline, no external library) ────────────────────────────────

type PlacesInputProps = {
  placeholder: string;
  onSelect: (s: PlaceSuggestion) => void;
};

function PlacesInput({ placeholder, onSelect }: PlacesInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [fetching, setFetching] = useState(false);
  const token = useRef(newSessionToken());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 3) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      setFetching(true);
      try { setSuggestions(await fetchSuggestions(text.trim(), token.current)); }
      catch { setSuggestions([]); }
      finally { setFetching(false); }
    }, 350);
  }, []);

  const handlePick = useCallback((item: PlaceSuggestion) => {
    setQuery(item.description);
    setSuggestions([]);
    token.current = newSessionToken();
    onSelect(item);
  }, [onSelect]);

  const clear = useCallback(() => { setQuery(''); setSuggestions([]); }, []);

  return (
    <View>
      <View style={acStyles.inputRow}>
        <Ionicons name="search-outline" size={16} color={colors.textSecondary} style={acStyles.icon} />
        <TextInput
          style={acStyles.input}
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={placeholder}
        />
        {fetching
          ? <ActivityIndicator size="small" color={colors.primary} style={acStyles.endIcon} />
          : query.length > 0
            ? (
              <Pressable onPress={clear} hitSlop={8} style={acStyles.endIcon}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            )
            : null}
      </View>
      {suggestions.length > 0 && (
        <View style={acStyles.suggestionList}>
          {suggestions.map((item, i) => (
            <View key={item.place_id}>
              {i > 0 && <View style={acStyles.sep} />}
              <Pressable
                style={({ pressed }) => [acStyles.suggestionRow, pressed && acStyles.rowPressed]}
                onPress={() => handlePick(item)}
                accessibilityRole="button"
              >
                <Ionicons name="location-outline" size={14} color={colors.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={acStyles.mainText} numberOfLines={1}>
                    {item.structured_formatting.main_text}
                  </Text>
                  <Text style={acStyles.subText} numberOfLines={1}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Helper: GPS coords ───────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function Header({
  addresses,
  selectedIndex,
  onSelectAddress,
  hasNotification = true,
  onNotificationPress,
}: HeaderProps) {
  const { addAddress, updateAddress } = useAuth();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('add');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);

  const selected = addresses[selectedIndex];
  const primaryLine = selected
    ? selected.locality?.trim() || selected.city
    : 'Set your location';

  // ── Address form handlers ────────────────────────────────────────────────

  const handleSelect = (index: number) => {
    onSelectAddress(index);
    setPickerVisible(false);
  };

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setFormMode('add');
    setEditingAddressId(null);
    setAutoFilled(false);
    setPickerVisible(false);
    setFormVisible(true);
  };

  const openEditForm = (addr: Address) => {
    setForm({
      label:    addr.label    ?? '',
      house:    addr.house    ?? '',
      street:   addr.street   ?? '',
      locality: addr.locality ?? '',
      city:     addr.city,
      state:    addr.state,
      pincode:  addr.pincode,
    });
    setFormMode('edit');
    setEditingAddressId(addr._id ?? null);
    setAutoFilled(false);
    setPickerVisible(false);
    setFormVisible(true);
  };

  // ── Places search → auto-fill form ──────────────────────────────────────────

  const handleAddressSelect = useCallback(async (suggestion: PlaceSuggestion) => {
    try {
      const details = await fetchPlaceDetails(suggestion.place_id, newSessionToken());
      if (!details) return;
      const c = details.components;
      setForm((prev) => ({
        ...prev,
        street:   [getComponent(c, 'street_number'), getComponent(c, 'route')].filter(Boolean).join(' '),
        locality: getComponent(c, 'sublocality_level_1') || getComponent(c, 'sublocality'),
        city:     getComponent(c, 'locality') || getComponent(c, 'administrative_area_level_2'),
        state:    getComponent(c, 'administrative_area_level_1'),
        pincode:  getComponent(c, 'postal_code'),
      }));
      setAutoFilled(true);
    } catch {
      Alert.alert('Error', 'Could not fetch address details. Please fill in manually.');
    }
  }, []);

  // ── GPS auto-detect → reverse-geocode → fill form ───────────────────────────

  const handleDetectLocation = useCallback(async () => {
    setDetectingGps(true);
    try {
      const coords = await getCoordsSilently();
      if (!coords) {
        Alert.alert('Permission denied', 'Location permission was not granted.');
        return;
      }
      const [addr] = await Location.reverseGeocodeAsync(coords);
      if (addr) {
        setForm((prev) => ({
          ...prev,
          street:   addr.street  ?? prev.street,
          locality: addr.district ?? addr.subregion ?? prev.locality,
          city:     addr.city    ?? prev.city,
          state:    addr.region  ?? prev.state,
          pincode:  addr.postalCode ?? prev.pincode,
        }));
        setAutoFilled(true);
      }
    } catch {
      Alert.alert('Location Error', 'Could not detect your location.');
    } finally {
      setDetectingGps(false);
    }
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
      Alert.alert('Missing fields', 'City, State, and Pincode are required.');
      return;
    }
    if (!/^\d{6}$/.test(form.pincode.trim())) {
      Alert.alert('Invalid pincode', 'Pincode must be exactly 6 digits.');
      return;
    }

    try {
      setSaving(true);
      const location = await getCoordsSilently();
      const addressPayload = {
        label:    form.label.trim()    || 'Home',
        house:    form.house.trim(),
        street:   form.street.trim(),
        locality: form.locality.trim(),
        city:     form.city.trim(),
        state:    form.state.trim(),
        pincode:  form.pincode.trim(),
      };

      if (formMode === 'edit' && editingAddressId) {
        await updateAddress(editingAddressId, addressPayload, location ?? undefined);
      } else {
        await addAddress(addressPayload);
        onSelectAddress(addresses.length);
      }

      setFormVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not save address.');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof typeof EMPTY_FORM) => (val: string) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Left: location tap ──────────────────────────────────────────── */}
      <View style={styles.left}>
        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="location-sharp" size={16} color={colors.white} />
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>Your Location</Text>
            <View style={styles.locationValueRow}>
              <Text style={styles.primaryLocation} numberOfLines={1}>{primaryLine}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.white} />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Right: notification bell ─────────────────────────────────────── */}
      <TouchableOpacity style={styles.bellButton} onPress={onNotificationPress} activeOpacity={0.7}>
        <Ionicons name="notifications-outline" size={20} color={colors.white} />
        {hasNotification && <View style={styles.dot} />}
      </TouchableOpacity>

      {/* ══════════════════════════════════════════════════════════════════
          ADDRESS PICKER MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Choose a location</Text>
            <FlatList
              data={addresses}
              keyExtractor={(_, i) => String(i)}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.emptyText}>No saved addresses yet.</Text>}
              renderItem={({ item, index }) => {
                const isActive = index === selectedIndex;
                const icon = item.label?.toLowerCase().includes('office') ? 'briefcase' : 'home';
                return (
                  <TouchableOpacity style={styles.addressItem} onPress={() => handleSelect(index)} activeOpacity={0.7}>
                    <View style={[styles.addrIcon, isActive && styles.addrIconActive]}>
                      <Ionicons name={icon} size={16} color={isActive ? colors.white : colors.textSecondary} />
                    </View>
                    <View style={styles.addrDetails}>
                      <Text style={[styles.addrLabel, isActive && styles.addrLabelActive]}>
                        {item.label || 'Address'}
                      </Text>
                      <Text style={styles.addrFull} numberOfLines={2}>
                        {[item.house, item.street, item.locality, item.city, item.state, item.pincode]
                          .filter(Boolean).join(', ')}
                      </Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => openEditForm(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.label ?? 'address'}`}
                    >
                      <Ionicons name="pencil-outline" size={17} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={styles.addBtn} onPress={openAddForm} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.addBtnText}>Add location</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          ADD / EDIT LOCATION FORM MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={() => setFormVisible(false)}>
            <Pressable style={[styles.sheet, styles.formSheet]} onPress={() => {}}>
              <View style={styles.handle} />

              {/* Header row */}
              <View style={styles.formHeaderRow}>
                <Text style={styles.sheetTitle}>
                  {formMode === 'edit' ? 'Edit location' : 'Add new location'}
                </Text>
                <TouchableOpacity onPress={() => setFormVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* ── Search bar + GPS detect ──────────────────────────── */}
                <Text style={styles.fieldLabel}>Search address</Text>
                <Text style={styles.fieldHint}>Type a street, area or landmark to auto-fill</Text>
                <PlacesInput
                  placeholder="e.g. MG Road, Bangalore…"
                  onSelect={handleAddressSelect}
                />

                {/* GPS detect button */}
                <TouchableOpacity
                  style={styles.detectBtn}
                  onPress={handleDetectLocation}
                  disabled={detectingGps}
                  activeOpacity={0.8}
                >
                  {detectingGps
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Ionicons name="locate" size={15} color={colors.primary} />}
                  <Text style={styles.detectBtnText}>
                    {detectingGps ? 'Detecting…' : 'Use my current location'}
                  </Text>
                </TouchableOpacity>

                {/* Auto-filled badge */}
                {autoFilled && (
                  <View style={styles.autoFilledBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                    <Text style={styles.autoFilledText}>Auto-filled — edit below if needed</Text>
                  </View>
                )}

                {/* Label quick-pick */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Label</Text>
                <View style={styles.labelRow}>
                  {['Home', 'Office', 'Other'].map((l) => (
                    <TouchableOpacity
                      key={l}
                      style={[styles.labelChip, form.label === l && styles.labelChipActive]}
                      onPress={() => set('label')(l)}
                    >
                      <Text style={[styles.labelChipText, form.label === l && styles.labelChipTextActive]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FormField label="Flat / House no." value={form.house} onChangeText={set('house')} placeholder="e.g. A-204" />
                <FormField label="Street" value={form.street} onChangeText={set('street')} placeholder="e.g. MG Road" />
                <FormField label="Locality / Area" value={form.locality} onChangeText={set('locality')} placeholder="e.g. Koregaon Park" />
                <FormField label="City *" value={form.city} onChangeText={set('city')} placeholder="e.g. Pune" />
                <FormField label="State *" value={form.state} onChangeText={set('state')} placeholder="e.g. Maharashtra" />
                <FormField
                  label="Pincode *"
                  value={form.pincode}
                  onChangeText={set('pincode')}
                  placeholder="6-digit pincode"
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.saveBtnText}>
                        {formMode === 'edit' ? 'Update location' : 'Save location'}
                      </Text>}
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── FormField sub-component ──────────────────────────────────────────────────

function FormField({
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
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const acStyles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.navInactive + '66',
    paddingHorizontal: spacing.md,
    height: 46,
  },
  icon: { marginRight: spacing.xs },
  input: {
    flex: 1,
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  endIcon: { marginLeft: spacing.xs },
  suggestionList: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.navInactive + '55',
    borderBottomLeftRadius: radii.sm,
    borderBottomRightRadius: radii.sm,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    zIndex: 99,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowPressed: { backgroundColor: colors.surface },
  mainText: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textPrimary },
  subText: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  sep: { height: 1, backgroundColor: colors.navInactive + '33', marginHorizontal: spacing.md },
});

const styles = StyleSheet.create({
  // ── header row ──────────────────────────────────────────────────────────────
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  locationText: { flex: 1 },
  locationLabel: {
    ...typography.locationLabel,
    marginBottom: 1,
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  primaryLocation: {
    ...typography.locationValue,
    maxWidth: '90%',
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: '#FF4D4D',
    borderWidth: 1.5,
    borderColor: '#f5f5f5',
  },

  // ── shared modal pieces ──────────────────────────────────────────────────────
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
    maxHeight: '65%',
  },
  formSheet: {
    maxHeight: '92%',
    paddingHorizontal: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navInactive,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.subheading,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    ...typography.caption,
    paddingVertical: spacing.lg,
  },

  // ── address items ────────────────────────────────────────────────────────────
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  addrIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrIconActive: { backgroundColor: colors.primary },
  addrDetails: { flex: 1 },
  addrLabel: { ...typography.name, fontSize: 14 },
  addrLabelActive: { color: colors.primary },
  addrFull: { ...typography.caption, marginTop: 2 },

  // ── add button ───────────────────────────────────────────────────────────────
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderColor: colors.surface,
  },
  addBtnText: {
    ...typography.bodyMedium,
    fontFamily: fonts.jakartaSemiBold,
    color: colors.primary,
  },

  // ── form header ──────────────────────────────────────────────────────────────
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  // ── search / detect section ──────────────────────────────────────────────────
  fieldHint: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
    lineHeight: 16,
  },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.primary + '55',
    backgroundColor: colors.primary + '0D',
    alignSelf: 'flex-start',
  },
  detectBtnText: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  autoFilledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginBottom: spacing.xs,
  },
  autoFilledText: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: '#15803D',
    flex: 1,
  },

  // ── label chips ──────────────────────────────────────────────────────────────
  labelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  labelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.navInactive,
    backgroundColor: colors.surface,
  },
  labelChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '18',
  },
  labelChipText: { ...typography.caption, fontSize: 13 },
  labelChipTextActive: { color: colors.primary, fontFamily: fonts.jostSemiBold },

  // ── form fields ──────────────────────────────────────────────────────────────
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.navInactive,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
    backgroundColor: colors.surface,
  },

  // ── save button ──────────────────────────────────────────────────────────────
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
    fontFamily: fonts.jakartaBold,
    color: colors.white,
    fontSize: 15,
  },
});
