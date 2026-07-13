import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Gender = 'Male' | 'Female' | 'Other';
const GENDERS: Gender[] = ['Male', 'Female', 'Other'];

type Coords = { latitude: number; longitude: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseReverseGeocode(geo: Location.LocationGeocodedAddress) {
  return {
    house:    [geo.streetNumber, geo.name].filter(Boolean).join(' ') || '',
    street:   geo.street ?? '',
    locality: geo.district ?? geo.subregion ?? '',
    city:     geo.city ?? geo.region ?? '',
    state:    geo.region ?? '',
    pincode:  geo.postalCode ?? '',
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * Onboarding – Complete Profile
 * Fields: name, gender, address (house, street, locality, city*, state*, pincode*)
 * GPS auto-detects and pre-fills address. lat/lng sent silently to backend.
 * Calls PUT /api/customer/auth/complete-profile
 * On success → navigate to /  (home, AuthGate sets isOnboarded)
 */
export default function OnboardingProfileScreen() {
  const router = useRouter();
  const { finishProfile, patchCustomer } = useAuth();
  const colors = useTheme();

  // ── Personal ─────────────────────────────────────────────────────────────
  const [name, setName]     = useState('');
  const [gender, setGender] = useState<Gender | ''>('');

  // ── Address ──────────────────────────────────────────────────────────────
  const [label, setLabel]     = useState('Home');
  const [house, setHouse]     = useState('');
  const [street, setStreet]   = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity]       = useState('');
  const [state, setState]     = useState('');
  const [pincode, setPincode] = useState('');

  // ── Location (sent to backend only) ──────────────────────────────────────
  const [coords, setCoords]         = useState<Coords | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locStatus, setLocStatus]   = useState<'idle' | 'detected' | 'denied' | 'error'>('idle');

  // ── Form state ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const clearError = () => setError('');

  const isValid =
    name.trim().length >= 2 &&
    gender !== '' &&
    city.trim().length > 0 &&
    state.trim().length > 0 &&
    pincode.length === 6;

  // ── Location detection ────────────────────────────────────────────────────
  const handleDetectLocation = async () => {
    setLocLoading(true);
    setLocStatus('idle');
    setError('');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocStatus('denied');
        setLocLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      setCoords({ latitude, longitude });

      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo) {
        const parsed = parseReverseGeocode(geo);
        if (!house.trim())    setHouse(parsed.house);
        if (!street.trim())   setStreet(parsed.street);
        if (!locality.trim()) setLocality(parsed.locality);
        if (!city.trim())     setCity(parsed.city);
        if (!state.trim())    setState(parsed.state);
        if (!pincode.trim())  setPincode(parsed.pincode.replace(/\D/g, '').slice(0, 6));
      }
      setLocStatus('detected');
    } catch {
      setLocStatus('error');
    } finally {
      setLocLoading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isValid) return;
    setError('');
    setLoading(true);

    try {
      await finishProfile({
        name: name.trim(),
        gender,
        address: {
          label:    label.trim()    || 'Home',
          house:    house.trim()    || undefined,
          street:   street.trim()   || undefined,
          locality: locality.trim() || undefined,
          city:     city.trim(),
          state:    state.trim(),
          pincode:  pincode.trim(),
        },
        location: coords ?? undefined,
      });
      patchCustomer({ isOnboarded: true, name: name.trim() });
      router.replace('/' as any);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Input style helper ────────────────────────────────────────────────────
  const inputStyle = (hasError = false) => ({
    color: colors.text,
    borderColor: hasError ? '#ef4444' : colors.backgroundElement,
    backgroundColor: colors.backgroundElement,
  });

  const locButtonLabel =
    locStatus === 'detected' ? '✓ Location detected' :
    locStatus === 'denied'   ? 'Permission denied — enter manually' :
    locStatus === 'error'    ? 'Could not detect — enter manually' :
    '📍 Auto-fill from current location';

  const locButtonColor =
    locStatus === 'detected' ? '#16a34a' :
    locStatus === 'denied' || locStatus === 'error' ? '#ef4444' :
    '#3b82f6';

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>

              {/* ── Header ── */}
              <View style={styles.header}>
                <ThemedText type="title">Complete your profile</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Just a few details to get you started.
                </ThemedText>
              </View>

              {/* ════ SECTION: Personal ════ */}
              <ThemedText type="subtitle">Personal Details</ThemedText>

              {/* Name */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Full Name *</ThemedText>
                <TextInput
                  style={[styles.input, inputStyle()]}
                  placeholder="e.g. Priya Sharma"
                  placeholderTextColor={colors.textSecondary}
                  value={name}
                  onChangeText={(v) => { setName(v); clearError(); }}
                  autoCapitalize="words"
                  textContentType="name"
                  returnKeyType="next"
                />
              </View>

              {/* Gender */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Gender *</ThemedText>
                <View style={styles.chipRow}>
                  {GENDERS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: gender === g ? '#3b82f6' : colors.backgroundElement,
                          borderColor:     gender === g ? '#3b82f6' : colors.backgroundElement,
                        },
                      ]}
                      onPress={() => { setGender(g); clearError(); }}
                      activeOpacity={0.8}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: gender === g ? '#fff' : colors.text, fontWeight: '600' }}
                      >
                        {g}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ════ SECTION: Address ════ */}
              <View style={styles.sectionDivider} />
              <ThemedText type="subtitle">Your Address</ThemedText>

              {/* Address label */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Label</ThemedText>
                <View style={styles.chipRow}>
                  {['Home', 'Work', 'Other'].map((l) => (
                    <TouchableOpacity
                      key={l}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: label === l ? '#3b82f6' : colors.backgroundElement,
                          borderColor:     label === l ? '#3b82f6' : colors.backgroundElement,
                        },
                      ]}
                      onPress={() => setLabel(l)}
                      activeOpacity={0.8}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: label === l ? '#fff' : colors.text, fontWeight: '600' }}
                      >
                        {l}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Auto-detect button */}
              <TouchableOpacity
                style={[styles.locButton, { borderColor: locButtonColor, opacity: locLoading ? 0.6 : 1 }]}
                onPress={handleDetectLocation}
                disabled={locLoading}
                activeOpacity={0.8}
              >
                {locLoading ? (
                  <ActivityIndicator size="small" color={locButtonColor} />
                ) : (
                  <ThemedText type="small" style={{ color: locButtonColor, fontWeight: '600' }}>
                    {locButtonLabel}
                  </ThemedText>
                )}
              </TouchableOpacity>

              {locStatus === 'denied' && (
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Go to Settings → Privacy → Location to allow access, or fill in your address below.
                </ThemedText>
              )}

              {/* House */}
              <View style={styles.field}>
                <ThemedText type="smallBold">House / Flat No.</ThemedText>
                <TextInput
                  style={[styles.input, inputStyle()]}
                  placeholder="e.g. Flat 2A, Block B"
                  placeholderTextColor={colors.textSecondary}
                  value={house}
                  onChangeText={(v) => { setHouse(v); clearError(); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              {/* Street */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Street</ThemedText>
                <TextInput
                  style={[styles.input, inputStyle()]}
                  placeholder="e.g. MG Road"
                  placeholderTextColor={colors.textSecondary}
                  value={street}
                  onChangeText={(v) => { setStreet(v); clearError(); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              {/* Locality */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Locality / Area</ThemedText>
                <TextInput
                  style={[styles.input, inputStyle()]}
                  placeholder="e.g. Koramangala"
                  placeholderTextColor={colors.textSecondary}
                  value={locality}
                  onChangeText={(v) => { setLocality(v); clearError(); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              {/* City + State */}
              <View style={styles.twoCol}>
                <View style={[styles.field, { flex: 1 }]}>
                  <ThemedText type="smallBold">City *</ThemedText>
                  <TextInput
                    style={[styles.input, inputStyle()]}
                    placeholder="e.g. Bengaluru"
                    placeholderTextColor={colors.textSecondary}
                    value={city}
                    onChangeText={(v) => { setCity(v); clearError(); }}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <ThemedText type="smallBold">State *</ThemedText>
                  <TextInput
                    style={[styles.input, inputStyle()]}
                    placeholder="e.g. Karnataka"
                    placeholderTextColor={colors.textSecondary}
                    value={state}
                    onChangeText={(v) => { setState(v); clearError(); }}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Pincode */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Pincode *</ThemedText>
                <TextInput
                  style={[styles.input, inputStyle(pincode.length > 0 && pincode.length < 6)]}
                  placeholder="6-digit pincode"
                  placeholderTextColor={colors.textSecondary}
                  value={pincode}
                  onChangeText={(v) => { setPincode(v.replace(/\D/g, '').slice(0, 6)); clearError(); }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {pincode.length > 0 && pincode.length < 6 && (
                  <ThemedText type="small" style={styles.fieldHint}>
                    Must be 6 digits
                  </ThemedText>
                )}
              </View>

              {/* Error */}
              {!!error && (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.button, { opacity: !isValid || loading ? 0.5 : 1 }]}
                onPress={handleSubmit}
                disabled={!isValid || loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.buttonText}>Save & Continue →</ThemedText>
                )}
              </TouchableOpacity>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  kav: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  content: { gap: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginVertical: Spacing.one,
  },
  field: { gap: Spacing.two },
  twoCol: { flexDirection: 'row', gap: Spacing.two },
  chipRow: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locButton: {
    height: 48,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  input: {
    height: 52,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  fieldHint: {
    color: '#ef4444',
    marginTop: -Spacing.one,
  },
  errorText: {
    color: '#ef4444',
    marginTop: -Spacing.one,
  },
  button: {
    height: 52,
    borderRadius: Spacing.two,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
