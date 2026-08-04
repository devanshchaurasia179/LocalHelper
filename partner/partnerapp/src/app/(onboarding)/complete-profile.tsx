import { useState, useCallback, useRef, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import type { MapPressEvent, Region } from "react-native-maps";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";

import { useCompleteProfile } from "@/hooks/useCompleteProfile";
import { useAuth } from "@/providers/AuthProvider";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { ROUTES } from "@/constants/routes";
import { colors, spacing, radii, fonts } from "@/constants/theme";
import { api } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

// EXPO_PUBLIC_ prefix makes this readable at JS runtime in both Expo Go and EAS builds.
// MAPS_KEY (without prefix) is used by app.config.js only for native map tiles.
const MAPS_KEY: string = process.env.EXPO_PUBLIC_MAPS_KEY ?? "";

const STEPS = ["Personal Info", "Address", "Service Location"] as const;
type Step = 0 | 1 | 2;

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry",
] as const;

function getComponent(
  components: AddressComponent[],
  type: string,
  form: "long_name" | "short_name" = "long_name"
): string {
  return components.find((c) => c.types.includes(type))?.[form] ?? "";
}

// ─── Places HTTP helpers ──────────────────────────────────────────────────────

async function fetchSuggestions(
  input: string,
  sessionToken: string
): Promise<PlaceSuggestion[]> {
  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/place/autocomplete/json",
    {
      params: {
        input,
        key: MAPS_KEY,
        language: "en",
        components: "country:in",
        sessiontoken: sessionToken,
      },
    }
  );
  if (__DEV__ && data.status !== "OK") {
    console.warn("[Places Autocomplete]", data.status, data.error_message);
  }
  return data.status === "OK" ? data.predictions : [];
}

async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<{ components: AddressComponent[]; lat: number; lng: number } | null> {
  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/place/details/json",
    {
      params: {
        place_id: placeId,
        fields: "address_components,geometry",
        key: MAPS_KEY,
        sessiontoken: sessionToken,
      },
    }
  );
  if (data.status !== "OK") return null;
  const result = data.result;
  return {
    components: result.address_components ?? [],
    lat: result.geometry?.location?.lat ?? 0,
    lng: result.geometry?.location?.lng ?? 0,
  };
}

/** Simple random session token */
function newSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── PlacesInput component ────────────────────────────────────────────────────
// Reusable autocomplete backed by the Places Autocomplete HTTP API.
// The suggestion list renders INLINE (not absolutely positioned) so it is
// never clipped by a parent ScrollView.

type PlacesInputProps = {
  placeholder: string;
  iconName: "search-outline" | "location-outline";
  onSelect: (suggestion: PlaceSuggestion) => void;
};

function PlacesInput({ placeholder, iconName, onSelect }: PlacesInputProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionToken = useRef(newSessionToken());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (text.trim().length < 3) { setSuggestions([]); return; }
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchSuggestions(text.trim(), sessionToken.current);
        setSuggestions(results);
      } catch (e) {
        console.warn("[PlacesInput] fetch error", e);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  const handlePick = useCallback((item: PlaceSuggestion) => {
    setQuery(item.description);
    setSuggestions([]);
    sessionToken.current = newSessionToken(); // rotate token after selection
    onSelect(item);
  }, [onSelect]);

  const handleClear = useCallback(() => {
    setQuery("");
    setSuggestions([]);
  }, []);

  return (
    // Outer View has no overflow:hidden so the inline list expands naturally
    <View>
      {/* Input row */}
      <View style={acStyles.inputRow}>
        <Ionicons name={iconName} size={16} color={colors.textSecondary} style={acStyles.icon} />
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
        {loading
          ? <ActivityIndicator size="small" color={colors.primary} style={acStyles.endIcon} />
          : query.length > 0
          ? (
            <Pressable onPress={handleClear} hitSlop={8} accessibilityLabel="Clear" style={acStyles.endIcon}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )
          : null}
      </View>

      {/* Inline suggestion list — renders below the input, pushes content down */}
      {suggestions.length > 0 && (
        <View style={acStyles.suggestionList}>
          {suggestions.map((item, index) => (
            <View key={item.place_id}>
              {index > 0 && <View style={acStyles.separator} />}
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

// ─── Step Indicator ───────────────────────────────────────────────────────────

const CIRCLE_SIZE = 32;

function StepIndicator({ current }: { current: Step }) {
  return (
    <View style={stepStyles.wrapper} accessibilityRole="progressbar">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={stepStyles.item}>
            {i > 0 && (
              <View style={stepStyles.lineTrack}>
                <View style={[stepStyles.lineFill, done && stepStyles.lineFillDone]} />
              </View>
            )}
            <View style={[stepStyles.dot, active && stepStyles.dotActive, done && stepStyles.dotDone]}>
              {done
                ? <Ionicons name="checkmark" size={14} color={colors.white} />
                : <Text style={[stepStyles.dotLabel, active && stepStyles.dotLabelActive]}>{i + 1}</Text>}
            </View>
            <Text style={[stepStyles.stepText, active && stepStyles.stepTextActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Field Label ──────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={fieldStyles.label}>
      {label}
      {required && <Text style={fieldStyles.required}> *</Text>}
    </Text>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CompleteProfileScreen() {
  const { patchPartner } = useAuth();
  const { complete, loading, error, clearError } = useCompleteProfile();
  const { profile, setProfile } = useOnboarding();

  const [step, setStep] = useState<Step>(0);

  // Step 0 — Personal Info (seeded from shared context)
  const [fullName, setFullNameLocal] = useState(profile.fullName);
  const [gender, setGenderLocal] = useState<string | null>(profile.gender);
  const [dateOfBirth, setDateOfBirthLocal] = useState<Date | null>(profile.dateOfBirth);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Wrappers that write through to context
  const setFullName = (v: string) => { setFullNameLocal(v); setProfile({ fullName: v }); };
  const setGender = (v: string | null) => { setGenderLocal(v); setProfile({ gender: v }); };
  const setDateOfBirth = (v: Date | null) => { setDateOfBirthLocal(v); setProfile({ dateOfBirth: v }); };

  // Step 1 — Address (seeded from shared context)
  const [house, setHouseLocal] = useState(profile.house);
  const [street, setStreetLocal] = useState(profile.street);
  const [locality, setLocalityLocal] = useState(profile.locality);
  const [city, setCityLocal] = useState(profile.city);
  const [state, setStateLocal] = useState(profile.state);
  const [pincode, setPincodeLocal] = useState(profile.pincode);
  const [showStateList, setShowStateList] = useState(false);
  const [addressFilled, setAddressFilled] = useState(
    profile.house.length > 0 || profile.street.length > 0 || profile.city.length > 0
  );

  const setHouse = (v: string) => { setHouseLocal(v); setProfile({ house: v }); };
  const setStreet = (v: string) => { setStreetLocal(v); setProfile({ street: v }); };
  const setLocality = (v: string) => { setLocalityLocal(v); setProfile({ locality: v }); };
  const setCity = (v: string) => { setCityLocal(v); setProfile({ city: v }); };
  const setState = (v: string) => { setStateLocal(v); setProfile({ state: v }); };
  const setPincode = (v: string) => { setPincodeLocal(v); setProfile({ pincode: v }); };

  // Step 2 — Service Location (seeded from shared context)
  const [locationCoords, setLocationCoordsLocal] = useState<{ latitude: number; longitude: number } | null>(profile.locationCoords);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">(
    profile.locationCoords ? "granted" : "idle"
  );
  const [locationAddress, setLocationAddressLocal] = useState<string | null>(profile.locationAddress);
  const [serviceRadius, setServiceRadiusLocal] = useState(profile.serviceRadius);
  const [mapRegion, setMapRegion] = useState<Region>(
    profile.locationCoords
      ? { ...profile.locationCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 20, longitudeDelta: 20 }
  );

  const setLocationCoords = (v: { latitude: number; longitude: number } | null) => {
    setLocationCoordsLocal(v);
    setProfile({ locationCoords: v });
  };
  const setLocationAddress = (v: string | null) => {
    setLocationAddressLocal(v);
    setProfile({ locationAddress: v });
  };
  const setServiceRadius = (v: number) => {
    setServiceRadiusLocal(v);
    setProfile({ serviceRadius: v });
  };

  // ── Prefill from server when navigating back to an already-completed profile
  // Only fires when context is still at defaults (e.g. fresh mount via replace).
  useEffect(() => {
    if (profile.fullName.length > 0) return; // context already has data, skip
    api.get<{
      profile: {
        fullName: string;
        gender: string | null;
        dateOfBirth: string | null;
        address: { house?: string; street?: string; locality?: string; city: string; state: string; pincode: string } | null;
        location: { latitude: number; longitude: number } | null;
        serviceRadius: number;
      };
    }>("/partner/auth/profile")
      .then(({ data }) => {
        const p = data.profile;
        const dob = p.dateOfBirth ? new Date(p.dateOfBirth) : null;
        const coords = p.location ?? null;

        // Batch-update context
        setProfile({
          fullName:      p.fullName ?? "",
          gender:        p.gender ?? null,
          dateOfBirth:   dob,
          house:         p.address?.house    ?? "",
          street:        p.address?.street   ?? "",
          locality:      p.address?.locality ?? "",
          city:          p.address?.city     ?? "",
          state:         p.address?.state    ?? "",
          pincode:       p.address?.pincode  ?? "",
          locationCoords: coords,
          locationAddress: null,
          serviceRadius: p.serviceRadius ?? 10,
        });

        // Sync local state so the currently-rendered fields update immediately
        setFullNameLocal(p.fullName ?? "");
        setGenderLocal(p.gender ?? null);
        setDateOfBirthLocal(dob);
        setHouseLocal(p.address?.house    ?? "");
        setStreetLocal(p.address?.street  ?? "");
        setLocalityLocal(p.address?.locality ?? "");
        setCityLocal(p.address?.city  ?? "");
        setStateLocal(p.address?.state ?? "");
        setPincodeLocal(p.address?.pincode ?? "");
        if (p.address?.city || p.address?.street) setAddressFilled(true);
        if (coords) {
          setLocationCoordsLocal(coords);
          setLocationStatus("granted");
          setMapRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
        }
        setServiceRadiusLocal(p.serviceRadius ?? 10);
      })
      .catch(() => {
        // silently ignore — partner can fill manually
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validation
  const step0Valid = fullName.trim().length >= 2 && gender !== null && dateOfBirth !== null;
  const step1Valid = city.trim().length > 0 && state.trim().length > 0 && /^\d{6}$/.test(pincode);

  const handleNext = () => { clearError(); if (step < 2) setStep((s) => (s + 1) as Step); };
  const handleBack = () => { clearError(); if (step > 0) setStep((s) => (s - 1) as Step); };
  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  // ── Address suggestion picked → fetch details & auto-fill ───────────────
  const handleAddressSelect = useCallback(async (suggestion: PlaceSuggestion) => {
    try {
      const details = await fetchPlaceDetails(suggestion.place_id, newSessionToken());
      if (!details) return;
      const c = details.components;

      const streetNumber = getComponent(c, "street_number");
      const routeName    = getComponent(c, "route");
      const sublocality  = getComponent(c, "sublocality_level_1") || getComponent(c, "sublocality");
      const cityName     = getComponent(c, "locality") || getComponent(c, "administrative_area_level_2");
      const stateName    = getComponent(c, "administrative_area_level_1");
      const postal       = getComponent(c, "postal_code");

      setStreet([streetNumber, routeName].filter(Boolean).join(" "));
      setLocality(sublocality);
      setCity(cityName);
      setState(
        INDIAN_STATES.find((s) => s.toLowerCase() === stateName.toLowerCase()) ?? stateName
      );
      setPincode(postal);
      setAddressFilled(true);
      clearError();
    } catch {
      Alert.alert("Error", "Could not fetch address details. Please fill in manually.");
    }
  }, [clearError]);

  // ── Location suggestion picked ────────────────────────────────────────────
  const handleLocationSelect = useCallback(async (suggestion: PlaceSuggestion) => {
    try {
      const details = await fetchPlaceDetails(suggestion.place_id, newSessionToken());
      if (!details) return;
      const coords = { latitude: details.lat, longitude: details.lng };
      setLocationCoords(coords);
      setLocationStatus("granted");
      setMapRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      setLocationAddress(suggestion.description);
    } catch {
      Alert.alert("Error", "Could not fetch location details.");
    }
  }, []);

  // ── GPS auto-detect ───────────────────────────────────────────────────────
  const handleRequestLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationStatus("denied"); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocationCoords(coords);
      setLocationStatus("granted");
      setMapRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      try {
        const [addr] = await Location.reverseGeocodeAsync(coords);
        if (addr) {
          setLocationAddress([addr.name, addr.street, addr.city, addr.region].filter(Boolean).join(", "));
        }
      } catch { /* ignore */ }
    } catch {
      Alert.alert("Location Error", "Could not fetch your location.");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  // ── Map tap ───────────────────────────────────────────────────────────────
  const handleMapPress = useCallback(async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const coords = { latitude, longitude };
    setLocationCoords(coords);
    setLocationStatus("granted");
    try {
      const [addr] = await Location.reverseGeocodeAsync(coords);
      if (addr) {
        setLocationAddress([addr.name, addr.street, addr.city, addr.region].filter(Boolean).join(", "));
      }
    } catch { /* ignore */ }
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!dateOfBirth) return;
    const success = await complete({
      fullName: fullName.trim(),
      gender: gender!,
      dateOfBirth: dateOfBirth.toISOString(),
      address: {
        house: house.trim(),
        street: street.trim(),
        locality: locality.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
      },
      location: locationCoords ?? undefined,
      serviceRadius,
    });
    if (success) {
      patchPartner({ isProfile: true });
      router.push(ROUTES.ONBOARDING.SERVICE as any);
    }
  }, [complete, fullName, gender, dateOfBirth, house, street, locality, city, state, pincode, locationCoords, serviceRadius, patchPartner]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>

        {/* Hero band */}
        <View style={styles.hero}>
          <View style={styles.triTopRight} pointerEvents="none" />
          <View style={styles.triTopRightInner} pointerEvents="none" />
          <View style={styles.triBottomLeft} pointerEvents="none" />
          <View style={styles.triMidRight} pointerEvents="none" />
          <View style={styles.triMidLeft} pointerEvents="none" />
          <View style={styles.triBottomRight} pointerEvents="none" />
          <Text style={styles.appName}>LocalHelpers Partner</Text>
          <Text style={styles.heroTitle}>Set up your{"\n"}profile</Text>
          <Text style={styles.heroSub}>
            {step === 0 && "Step 1 of 3 — Tell us about yourself"}
            {step === 1 && "Step 2 of 3 — Where do you live?"}
            {step === 2 && "Step 3 of 3 — Where do you want to work?"}
          </Text>
        </View>

        {/* White card */}
        <View style={styles.card}>
          <View style={styles.handle} />
          <StepIndicator current={step} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            nestedScrollEnabled
          >

            {/* ── Step 0: Personal Info ──────────────────────────── */}
            {step === 0 && (
              <View style={styles.section}>
                <FieldLabel label="Full name" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rajesh Kumar"
                  placeholderTextColor={colors.textSecondary}
                  value={fullName}
                  onChangeText={(t) => { clearError(); setFullName(t); }}
                  autoCapitalize="words"
                  returnKeyType="done"
                  accessibilityLabel="Full name"
                />

                <FieldLabel label="Gender" required />
                <View style={styles.chipRow}>
                  {GENDERS.map((g) => (
                    <Pressable
                      key={g}
                      style={[styles.chip, gender === g && styles.chipSelected]}
                      onPress={() => { clearError(); setGender(g); }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: gender === g }}
                      accessibilityLabel={g}
                    >
                      <Text style={[styles.chipText, gender === g && styles.chipTextSelected]}>{g}</Text>
                    </Pressable>
                  ))}
                </View>

                <FieldLabel label="Date of birth" required />
                <Pressable
                  style={[styles.input, styles.row]}
                  onPress={() => setShowDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Pick date of birth"
                >
                  <Text style={[styles.inputText, !dateOfBirth && styles.placeholder]}>
                    {dateOfBirth ? formatDate(dateOfBirth) : "DD Mon YYYY"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                </Pressable>
                {showDatePicker && (
                  <DateTimePicker
                    value={dateOfBirth ?? new Date(1995, 0, 1)}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    minimumDate={new Date(1940, 0, 1)}
                    onChange={(_, selected) => {
                      setShowDatePicker(Platform.OS === "ios");
                      if (selected) setDateOfBirth(selected);
                    }}
                  />
                )}
              </View>
            )}

            {/* ── Step 1: Address ────────────────────────────────────── */}
            {step === 1 && (
              <View style={styles.section}>

                {/* Places search → auto-fills fields below */}
                <FieldLabel label="Search your address" required />
                <Text style={styles.fieldHint}>
                  Type a street, area or landmark to auto-fill the form
                </Text>
                <PlacesInput
                  placeholder="e.g. Lawrence Road, Amritsar…"
                  iconName="search-outline"
                  onSelect={handleAddressSelect}
                />

                {/* Auto-filled badge */}
                {addressFilled && (
                  <View style={styles.autoFilledBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.successDark} />
                    <Text style={styles.autoFilledText}>
                      Address auto-filled — edit below if needed
                    </Text>
                  </View>
                )}

                {/* Editable fields — always visible so user can override */}
                <FieldLabel label="Flat / House no." />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 12A"
                  placeholderTextColor={colors.textSecondary}
                  value={house}
                  onChangeText={setHouse}
                  returnKeyType="next"
                  accessibilityLabel="House number"
                />

                <FieldLabel label="Street / Road" />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. MG Road"
                  placeholderTextColor={colors.textSecondary}
                  value={street}
                  onChangeText={setStreet}
                  returnKeyType="next"
                  accessibilityLabel="Street"
                />

                <FieldLabel label="Locality / Area" />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Koramangala"
                  placeholderTextColor={colors.textSecondary}
                  value={locality}
                  onChangeText={setLocality}
                  returnKeyType="next"
                  accessibilityLabel="Locality"
                />

                <FieldLabel label="City" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Bangalore"
                  placeholderTextColor={colors.textSecondary}
                  value={city}
                  onChangeText={(t) => { clearError(); setCity(t); }}
                  returnKeyType="next"
                  accessibilityLabel="City"
                />

                <FieldLabel label="State" required />
                <Pressable
                  style={[styles.input, styles.row]}
                  onPress={() => setShowStateList((v) => !v)}
                  accessibilityRole="combobox"
                  accessibilityLabel="Select state"
                >
                  <Text style={[styles.inputText, !state && styles.placeholder]}>
                    {state || "Select state"}
                  </Text>
                  <Ionicons name={showStateList ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                </Pressable>

                {showStateList && (
                  <View style={styles.stateList}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {INDIAN_STATES.map((s) => (
                        <Pressable
                          key={s}
                          style={[styles.stateItem, state === s && styles.stateItemSelected]}
                          onPress={() => { setState(s); setShowStateList(false); clearError(); }}
                          accessibilityRole="menuitem"
                          accessibilityState={{ selected: state === s }}
                        >
                          <Text style={{ fontFamily: fonts.jostRegular, fontSize: 14, color: state === s ? colors.primary : colors.textPrimary }}>
                            {s}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <FieldLabel label="Pincode" required />
                <TextInput
                  style={[styles.input, pincode.length > 0 && !/^\d{6}$/.test(pincode) && styles.inputError]}
                  placeholder="6-digit pincode"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={pincode}
                  onChangeText={(t) => { clearError(); setPincode(t.replace(/\D/g, "")); }}
                  returnKeyType="done"
                  accessibilityLabel="Pincode"
                />
                {pincode.length > 0 && !/^\d{6}$/.test(pincode) && (
                  <Text style={styles.fieldError}>Must be exactly 6 digits</Text>
                )}
              </View>
            )}

            {/* ── Step 2: Service Location ───────────────────────────────────── */}
            {step === 2 && (
              <View style={styles.section}>

                {/* Places search for service location pin */}
                <FieldLabel label="Where do you want to work?" />
                <Text style={styles.fieldHint}>
                  Search your primary work area or tap the map to pin it
                </Text>
                <PlacesInput
                  placeholder="e.g. Ranjit Avenue, Amritsar"
                  iconName="location-outline"
                  onSelect={handleLocationSelect}
                />

                {/* Map */}
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    region={mapRegion}
                    onPress={handleMapPress}
                    showsUserLocation
                    showsMyLocationButton={false}
                    toolbarEnabled={false}
                  >
                    {locationCoords && (
                      <Marker coordinate={locationCoords} pinColor={colors.primary} />
                    )}
                  </MapView>

                  {/* Floating auto-detect button */}
                  <Pressable
                    style={({ pressed }) => [styles.autoDetectBtn, pressed && { opacity: 0.85 }]}
                    onPress={handleRequestLocation}
                    disabled={locationLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Auto-detect my location"
                  >
                    {locationLoading
                      ? <ActivityIndicator color={colors.primary} size="small" />
                      : (
                        <>
                          <Ionicons name="locate" size={15} color={colors.primary} />
                          <Text style={styles.autoDetectText}>Auto-detect</Text>
                        </>
                      )}
                  </Pressable>
                </View>

                {/* Location confirmed card */}
                {locationStatus === "granted" && locationCoords && (
                  <View style={styles.locationInfoCard}>
                    <View style={styles.locationInfoHeader}>
                      <Ionicons name="location" size={16} color={colors.successDark} />
                      <Text style={styles.locationInfoTitle}>Location set</Text>
                    </View>
                    {locationAddress && (
                      <Text style={styles.locationInfoAddr}>{locationAddress}</Text>
                    )}
                    <Text style={styles.locationInfoCoords}>
                      {locationCoords.latitude.toFixed(5)}, {locationCoords.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}

                {locationStatus === "denied" && (
                  <View style={styles.deniedCard}>
                    <View style={styles.deniedRow}>
                      <Ionicons name="warning-outline" size={16} color={colors.errorDark} />
                      <Text style={styles.deniedText}>
                        Permission denied. Search above or tap the map to set your work location.
                      </Text>
                    </View>
                  </View>
                )}

                {/* ── Service Radius Slider ─────────────────────────────────── */}
                <View style={styles.radiusCard}>
                  <View style={styles.radiusHeader}>
                    <View style={styles.radiusHeaderLeft}>
                      <Ionicons name="radio-outline" size={16} color={colors.primary} />
                      <Text style={styles.radiusTitle}>Working radius</Text>
                    </View>
                    <View style={styles.radiusBadge}>
                      <Text style={styles.radiusBadgeText}>{serviceRadius} km</Text>
                    </View>
                  </View>
                  <Text style={styles.radiusHint}>
                    You'll receive job requests within this distance from your pinned location
                  </Text>

                  {/* Manual step buttons — no native Slider dependency needed */}
                  <View style={styles.radiusRow}>
                    <Pressable
                      style={[styles.radiusStepBtn, serviceRadius <= 5 && styles.radiusStepBtnDisabled]}
                      onPress={() => setServiceRadius((r) => Math.max(5, r - 5))}
                      disabled={serviceRadius <= 5}
                      accessibilityLabel="Decrease radius"
                      hitSlop={6}
                    >
                      <Ionicons name="remove" size={18} color={serviceRadius <= 5 ? colors.textSecondary : colors.primary} />
                    </Pressable>

                    {/* Visual track */}
                    <View style={styles.radiusTrack}>
                      <View style={[styles.radiusFill, { flex: (serviceRadius - 5) / 45 }]} />
                      <View style={{ flex: (50 - serviceRadius) / 45 }} />
                    </View>

                    <Pressable
                      style={[styles.radiusStepBtn, serviceRadius >= 50 && styles.radiusStepBtnDisabled]}
                      onPress={() => setServiceRadius((r) => Math.min(50, r + 5))}
                      disabled={serviceRadius >= 50}
                      accessibilityLabel="Increase radius"
                      hitSlop={6}
                    >
                      <Ionicons name="add" size={18} color={serviceRadius >= 50 ? colors.textSecondary : colors.primary} />
                    </Pressable>
                  </View>

                  {/* Preset chips */}
                  <View style={styles.radiusPresets}>
                    {[5, 10, 15, 20, 30, 50].map((preset) => (
                      <Pressable
                        key={preset}
                        style={[styles.radiusPresetChip, serviceRadius === preset && styles.radiusPresetChipActive]}
                        onPress={() => setServiceRadius(preset)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: serviceRadius === preset }}
                        accessibilityLabel={`${preset} km`}
                      >
                        <Text style={[styles.radiusPresetText, serviceRadius === preset && styles.radiusPresetTextActive]}>
                          {preset} km
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Text style={styles.skipNote}>
                  {locationStatus === "granted" ? "Tap the map to adjust your work location. Tap " : "Location is optional — tap "}
                  <Text style={{ fontFamily: fonts.jostSemiBold, color: colors.primary }}>
                    {locationStatus === "granted" ? "Save profile" : "Skip & save"}
                  </Text>
                  {locationStatus === "granted" ? " when ready." : " to continue without it."}
                </Text>
              </View>
            )}

            {/* Error banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#991B1B" style={{ marginRight: 6 }} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Nav buttons */}
            <View style={styles.navRow}>
              {step > 0 && (
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={handleBack}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <Ionicons name="arrow-back" size={16} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </Pressable>
              )}

              {step < 2 ? (
                <Pressable
                  style={[
                    styles.primaryBtn,
                    ((step === 0 && !step0Valid) || (step === 1 && !step1Valid)) && styles.primaryBtnDisabled,
                    step === 0 && { flex: 1 },
                  ]}
                  onPress={handleNext}
                  disabled={(step === 0 && !step0Valid) || (step === 1 && !step1Valid)}
                  accessibilityRole="button"
                  accessibilityLabel="Continue"
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.white} style={{ marginLeft: 4 }} />
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={locationStatus === "granted" ? "Save profile" : "Skip & save"}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Ionicons
                        name={locationStatus === "granted" ? "checkmark-circle-outline" : "play-skip-forward-outline"}
                        size={16}
                        color={colors.white}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.primaryBtnText}>
                        {locationStatus === "granted" ? "Save profile" : "Skip & save"}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const acStyles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "66",
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
  // Inline list — no absolute positioning, expands inside ScrollView naturally
  suggestionList: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.navInactive + "55",
    borderBottomLeftRadius: radii.sm,
    borderBottomRightRadius: radii.sm,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowPressed: { backgroundColor: colors.surface },
  mainText: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textPrimary },
  subText: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  separator: { height: 1, backgroundColor: colors.navInactive + "33", marginHorizontal: spacing.md },
});

const stepStyles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  item: { flex: 1, alignItems: "center", position: "relative" },
  lineTrack: {
    position: "absolute",
    top: CIRCLE_SIZE / 2 - 1,
    left: -35,
    right: "50%",
    height: 2,
    overflow: "hidden",
  },
  lineFill: { flex: 1, backgroundColor: colors.navInactive + "99" },
  lineFillDone: { backgroundColor: colors.success },
  dot: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.navInactive,
    zIndex: 1,
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotLabel: { fontFamily: fonts.oswaldSemiBold, fontSize: 13, color: colors.navInactive },
  dotLabelActive: { color: colors.white },
  stepText: { fontFamily: fonts.jostRegular, fontSize: 10, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  stepTextActive: { fontFamily: fonts.jostSemiBold, color: colors.primary },
});

const fieldStyles = StyleSheet.create({
  label: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  required: { color: "#EF4444" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },

  hero: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingTop: 64,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 16,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  appName: { fontFamily: fonts.jostSemiBold, fontSize: 13, color: "rgba(255,255,255,0.7)", letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.sm },
  heroTitle: { fontFamily: fonts.oswaldBold, fontSize: 30, color: colors.white, lineHeight: 38, letterSpacing: 0.3 },
  heroSub: { fontFamily: fonts.jostRegular, fontSize: 14, color: "rgba(255,255,255,0.65)", marginTop: spacing.xs, lineHeight: 20 },

  triTopRight: { position: "absolute", top: -30, right: -30, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 140, borderBottomWidth: 140, borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.07)" },
  triTopRightInner: { position: "absolute", top: 10, right: 10, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 90, borderBottomWidth: 90, borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.05)" },
  triBottomLeft: { position: "absolute", bottom: 28, left: -20, width: 0, height: 0, borderStyle: "solid", borderRightWidth: 110, borderTopWidth: 110, borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)" },
  triMidRight: { position: "absolute", top: "42%", right: 30, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 50, borderBottomWidth: 50, borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.08)", transform: [{ rotate: "20deg" }] },
  triMidLeft: { position: "absolute", top: "30%", left: 20, width: 0, height: 0, borderStyle: "solid", borderRightWidth: 36, borderTopWidth: 36, borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.05)", transform: [{ rotate: "-15deg" }] },
  triBottomRight: { position: "absolute", bottom: -30, right: -30, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 130, borderTopWidth: 130, borderLeftColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)", transform: [{ rotate: "-5deg" }] },

  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    marginTop: -28,
    flex: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: spacing.md },
  scroll: { paddingBottom: spacing.xl },
  section: { gap: spacing.sm },

  // Base input / shared row
  input: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "66",
  },
  inputError: { borderColor: "#EF4444" },
  inputText: { fontFamily: fonts.jostRegular, fontSize: 15, color: colors.textPrimary, flex: 1 },
  placeholder: { color: colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  fieldHint: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: -spacing.xs, lineHeight: 16 },
  fieldError: { fontFamily: fonts.jostRegular, color: "#EF4444", fontSize: 12, marginTop: -spacing.xs },

  autoFilledBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.successLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.success + "44",
  },
  autoFilledText: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.successDark, flex: 1 },

  stateList: { backgroundColor: colors.surface, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.navInactive + "44", overflow: "hidden", marginTop: -spacing.sm },
  stateItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  stateItemSelected: { backgroundColor: colors.primary + "14" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.navInactive, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textSecondary },
  chipTextSelected: { color: colors.white },

  mapContainer: { height: 220, borderRadius: radii.md, overflow: "hidden", borderWidth: 1.5, borderColor: colors.navInactive + "44", position: "relative" },
  map: { flex: 1 },
  autoDetectBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.primary + "33",
  },
  autoDetectText: { fontFamily: fonts.jostSemiBold, fontSize: 13, color: colors.primary },

  locationInfoCard: { borderRadius: radii.md, padding: spacing.md, gap: 4, borderWidth: 1.5, borderColor: colors.success + "44", backgroundColor: colors.successLight },
  locationInfoHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationInfoTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.successDark },
  locationInfoAddr: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  locationInfoCoords: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary },

  deniedCard: { borderRadius: radii.md, padding: spacing.md, borderWidth: 1.5, borderColor: colors.error + "33", backgroundColor: colors.errorLight },
  deniedRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  deniedText: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.errorDark, lineHeight: 18, flex: 1 },

  skipNote: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, lineHeight: 18, textAlign: "center", marginTop: spacing.sm },

  // ── Service radius ─────────────────────────────────────────────────────────
  radiusCard: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary + "33",
    backgroundColor: colors.primary + "08",
    padding: spacing.md,
    gap: spacing.sm,
  },
  radiusHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  radiusHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  radiusTitle: { fontFamily: fonts.jostSemiBold, fontSize: 14, color: colors.textPrimary },
  radiusBadge: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  radiusBadgeText: { fontFamily: fonts.oswaldSemiBold, fontSize: 13, color: colors.white },
  radiusHint: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  radiusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  radiusTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.navInactive + "55",
    flexDirection: "row",
    overflow: "hidden",
  },
  radiusFill: { backgroundColor: colors.primary, borderRadius: 3 },
  radiusStepBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  radiusStepBtnDisabled: { borderColor: colors.navInactive + "66", backgroundColor: colors.surface },
  radiusPresets: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
  radiusPresetChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.navInactive,
    backgroundColor: colors.white,
  },
  radiusPresetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  radiusPresetText: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary },
  radiusPresetTextActive: { color: colors.white },

  errorBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEE2E2", borderRadius: radii.sm, padding: spacing.md, marginTop: spacing.sm },
  errorBannerText: { fontFamily: fonts.jostMedium, color: "#991B1B", fontSize: 13, flex: 1 },

  navRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center", justifyContent: "center", flexDirection: "row", shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontFamily: fonts.jakartaBold, color: colors.white, fontSize: 15, letterSpacing: 0.3 },
  secondaryBtn: { borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", flexDirection: "row", borderWidth: 1.5, borderColor: colors.navInactive, backgroundColor: colors.surface },
  secondaryBtnText: { fontFamily: fonts.jostMedium, fontSize: 15, color: colors.textSecondary },
});
