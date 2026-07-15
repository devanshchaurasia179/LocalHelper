import { useState } from 'react';
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
import { colors, spacing, radii } from './theme';
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

  const selected = addresses[selectedIndex];
  const primaryLine = selected
    ? selected.locality?.trim() || selected.city
    : 'Set your location';
  const secondaryLine = selected ? `${selected.city}, ${selected.state}` : '';

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSelect = (index: number) => {
    onSelectAddress(index);
    setPickerVisible(false);
  };

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setFormMode('add');
    setEditingAddressId(null);
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
    setPickerVisible(false);
    setFormVisible(true);
  };

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

      // Silently grab GPS — no prompt shown to user, ignored if unavailable
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
        // Auto-select the newly added address
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
      {/* ── Left: location tap ─────────────────────────────────────── */}
      <View style={styles.left}>

        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="location-sharp" size={16} color="rgba(255,255,255,0.8)" />
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>Your Location</Text>
            <View style={styles.locationValueRow}>
              <Text style={styles.primaryLocation} numberOfLines={1}>
                {primaryLine}
              </Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Right: notification bell ────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.bellButton}
        onPress={onNotificationPress}
        activeOpacity={0.7}
      >
        <Ionicons name="notifications-outline" size={20} color={colors.white} />
        {hasNotification && <View style={styles.dot} />}
      </TouchableOpacity>

      {/* ════════════════════════════════════════════════════════════════════
          ADDRESS PICKER MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)}>
          {/* stop inner taps from closing */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            {/* drag handle */}
            <View style={styles.handle} />

            <Text style={styles.sheetTitle}>Choose a location</Text>

            <FlatList
              data={addresses}
              keyExtractor={(_, i) => String(i)}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No saved addresses yet.</Text>
              }
              renderItem={({ item, index }) => {
                const isActive = index === selectedIndex;
                const icon =
                  item.label?.toLowerCase().includes('office') ? 'briefcase' : 'home';
                return (
                  <TouchableOpacity
                    style={styles.addressItem}
                    onPress={() => handleSelect(index)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.addrIcon, isActive && styles.addrIconActive]}>
                      <Ionicons
                        name={icon}
                        size={16}
                        color={isActive ? colors.white : colors.textSecondary}
                      />
                    </View>
                    <View style={styles.addrDetails}>
                      <Text style={[styles.addrLabel, isActive && styles.addrLabelActive]}>
                        {item.label || 'Address'}
                      </Text>
                      <Text style={styles.addrFull} numberOfLines={2}>
                        {[item.house, item.street, item.locality, item.city, item.state, item.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                    {/* Edit pencil */}
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

            {/* Add location button */}
            <TouchableOpacity style={styles.addBtn} onPress={openAddForm} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.addBtnText}>Add location</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          ADD / EDIT LOCATION FORM MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.backdrop} onPress={() => setFormVisible(false)}>
            <Pressable style={[styles.sheet, styles.formSheet]} onPress={() => {}}>
              {/* drag handle */}
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
                {/* Label quick-pick */}
                <Text style={styles.fieldLabel}>Label</Text>
                <View style={styles.labelRow}>
                  {['Home', 'Office', 'Other'].map((l) => (
                    <TouchableOpacity
                      key={l}
                      style={[styles.labelChip, form.label === l && styles.labelChipActive]}
                      onPress={() => set('label')(l)}
                    >
                      <Text style={[styles.labelChipText, form.label === l && styles.labelChipTextActive]}>
                        {l}
                      </Text>
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
                  {saving ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {formMode === 'edit' ? 'Update location' : 'Save location'}
                    </Text>
                  )}
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

const styles = StyleSheet.create({
  // header row
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  locationText: { flex: 1 },
  locationLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  primaryLocation: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  secondaryLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
    borderColor: colors.primary,
  },

  // shared modal pieces
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
    maxHeight: '90%',
    paddingHorizontal: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
    fontSize: 14,
  },

  // address items
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
  addrLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  addrLabelActive: { color: colors.primary },
  addrFull: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // add button at bottom of picker
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // form header
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    marginBottom: spacing.sm,
  },

  // label quick-pick chips
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
    borderColor: '#DDD',
    backgroundColor: colors.surface,
  },
  labelChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '18',
  },
  labelChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  labelChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // form fields
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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

  // save button
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
