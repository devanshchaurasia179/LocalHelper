import { useState, useCallback, useRef } from "react";
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
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import type { MapPressEvent, Region } from "react-native-maps";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";

import { useCompleteProfile } from "@/hooks/useCompleteProfile";
import { useAuth } from "@/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";
import { colors, spacing, radii, fonts } from "@/app/(tabs)/home/theme";

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

const MAPS_KEY: string = process.env.EXPO_PUBLIC_MAPS_KEY ?? "";

const STEPS = ["Personal Info", "Address", "Location"] as const;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getComponent(
  components: AddressComponent[],
  type: string,
  form: "long_name" | "short_name" = "long_name"
): string {
  return components.find((c) => c.types.includes(type))?.[form] ?? "";
}

function newSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function fetchSuggestions(input: string, sessionToken: string): Promise<PlaceSuggestion[]> {
  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/place/autocomplete/json",
    { params: { input, key: MAPS_KEY, language: "en", components: "country:in", sessiontoken: sessionToken } }
  );
  if (__DEV__ && data.status !== "OK") console.warn("[Places]", data.status, data.error_message);
  return data.status === "OK" ? data.predictions : [];
}

async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<{ components: AddressComponent[]; lat: number; lng: number } | null> {
  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/place/details/json",
    { params: { place_id: placeId, fields: "address_components,geometry", key: MAPS_KEY, sessiontoken: sessionToken } }
  );
  if (data.status !== "OK") return null;
  return {
    components: data.result.address_components ?? [],
    lat: data.result.geometry?.location?.lat ?? 0,
    lng: data.result.geometry?.location?.lng ?? 0,
  };
}

// ─── PlacesInput ──────────────────────────────────────────────────────────────

type PlacesInputProps = {
  placeholder: string;
  iconName: "search-outline" | "location-outline";
  onSelect: (s: PlaceSuggestion) => void;
};

function PlacesInput({ placeholder, iconName, onSelect }: PlacesInputProps) {
  const [query, setQuery] = useState("");
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

  return (
    <View>
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
        {fetching
          ? <ActivityIndicator size="small" color={colors.primary} style={acStyles.endIcon} />
          : query.length > 0
            ? <Pressable onPress={() => { setQuery(""); setSuggestions([]); }} hitSlop={8} style={acStyles.endIcon}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            : null}
      </View>
      {suggestions.length > 0 && (
        <View style={acStyles.suggestionList}>
          {suggestions.map((item, i) => (
            <View key={item.place_id}>
              {i > 0 && <View style={acStyles.separator} />}
              <Pressable
                style={({ pressed }) => [acStyles.suggestionRow, pressed && acStyles.rowPressed]}
                onPress={() => handlePick(item)}
                accessibilityRole="button"
              >
                <Ionicons name="location-outline" size={14} color={colors.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={acStyles.mainText} numberOfLines={1}>{item.structured_formatting.main_text}</Text>
                  <Text style={acStyles.subText} numberOfLines={1}>{item.structured_formatting.secondary_text}</Text>
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

const CIRCLE = 32;

function StepIndicator({ current }: { current: Step }) {
  return (
    <View style={stepStyles.wrapper} accessibilityRole="progressbar">
      {STEPS.map((lbl, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={lbl} style={stepStyles.item}>
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
            <Text style={[stepStyles.stepText, active && stepStyles.stepTextActive]}>{lbl}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Field Label ──────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={fldStyles.label}>
      {label}{required && <Text style={fldStyles.required}> *</Text>}
    </Text>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { patchCustomer } = useAuth();
  const { complete, loading, error, clearError } = useCompleteProfile();
  const [step, setStep] = useState<Step>(0);

  // Step 0
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string | null>(null);

  // Step 1
  const [addrLabel, setAddrLabel] = useState("Home");
  const [house, setHouse] = useState("");
  const [street, setStreet] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [showStateList, setShowStateList] = useState(false);
  const [addressFilled, setAddressFilled] = useState(false);

  // Step 2
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 20.5937, longitude: 78.9629, latitudeDelta: 20, longitudeDelta: 20,
  });

  const step0Valid = name.trim().length >= 2 && gender !== null;
  const step1Valid = city.trim().length > 0 && state.trim().length > 0 && /^\d{6}$/.test(pincode);

  const handleNext = () => { clearError(); if (step < 2) setStep((s) => (s + 1) as Step); };
  const handleBack = () => { clearError(); if (step > 0) setStep((s) => (s - 1) as Step); };

  // Address search → auto-fill
  const handleAddressSelect = useCallback(async (suggestion: PlaceSuggestion) => {
    try {
      const details = await fetchPlaceDetails(suggestion.place_id, newSessionToken());
      if (!details) return;
      const c = details.components;
      setStreet([getComponent(c, "street_number"), getComponent(c, "route")].filter(Boolean).join(" "));
      setLocality(getComponent(c, "sublocality_level_1") || getComponent(c, "sublocality"));
      setCity(getComponent(c, "locality") || getComponent(c, "administrative_area_level_2"));
      const sn = getComponent(c, "administrative_area_level_1");
      setState(INDIAN_STATES.find((s) => s.toLowerCase() === sn.toLowerCase()) ?? sn);
      setPincode(getComponent(c, "postal_code"));
      setAddressFilled(true);
      clearError();
    } catch {
      Alert.alert("Error", "Could not fetch address details. Please fill in manually.");
    }
  }, [clearError]);

  // Location search
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

  // GPS auto-detect
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
        if (addr) setLocationAddress([addr.name, addr.street, addr.city, addr.region].filter(Boolean).join(", "));
      } catch { /* ignore */ }
    } catch {
      Alert.alert("Location Error", "Could not fetch your location.");
    } finally { setLocationLoading(false); }
  }, []);

  // Map tap
  const handleMapPress = useCallback(async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const coords = { latitude, longitude };
    setLocationCoords(coords);
    setLocationStatus("granted");
    try {
      const [addr] = await Location.reverseGeocodeAsync(coords);
      if (addr) setLocationAddress([addr.name, addr.street, addr.city, addr.region].filter(Boolean).join(", "));
    } catch { /* ignore */ }
  }, []);

  // Submit
  const handleSubmit = useCallback(async () => {
    const success = await complete({
      name: name.trim(),
      gender: gender!,
      address: {
        label: addrLabel.trim() || "Home",
        house: house.trim(), street: street.trim(), locality: locality.trim(),
        city: city.trim(), state: state.trim(), pincode: pincode.trim(),
      },
      location: locationCoords ?? undefined,
    });
    if (success) { patchCustomer({ isOnboarded: true }); router.replace(ROUTES.APP.HOME as any); }
  }, [complete, name, gender, addrLabel, house, street, locality, city, state, pincode, locationCoords, patchCustomer]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>

        {/* ── Hero band ─────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.triTopRight}      pointerEvents="none" />
          <View style={styles.triTopRightInner} pointerEvents="none" />
          <View style={styles.triBottomLeft}    pointerEvents="none" />
          <View style={styles.triMidRight}      pointerEvents="none" />
          <View style={styles.triMidLeft}       pointerEvents="none" />
          <View style={styles.triBottomRight}   pointerEvents="none" />
          <Text style={styles.appName}>LocalHelpers</Text>
          <Text style={styles.heroTitle}>Complete your{"\n"}profile</Text>
          <Text style={styles.heroSub}>
            {step === 0 && "Step 1 of 3 — Tell us about yourself"}
            {step === 1 && "Step 2 of 3 — Where do you live?"}
            {step === 2 && "Step 3 of 3 — Confirm your location"}
          </Text>
        </View>

        {/* ── White card ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.handle} />
          <StepIndicator current={step} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            nestedScrollEnabled
          >

            {/* ── Step 0: Personal Info ──────────────────────── */}
            {step === 0 && (
              <View style={styles.section}>
                <FieldLabel label="Full name" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={colors.textSecondary}
                  value={name}
                  onChangeText={(t) => { clearError(); setName(t); }}
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
              </View>
            )}

            {/* ── Step 1: Address ────────────────────────────── */}
            {step === 1 && (
              <View style={styles.section}>

                {/* Address label chips */}
                <FieldLabel label="Address label" />
                <View style={styles.chipRow}>
                  {["Home", "Work", "Other"].map((l) => (
                    <Pressable key={l} style={[styles.chip, addrLabel === l && styles.chipSelected]} onPress={() => setAddrLabel(l)}
                      accessibilityRole="radio" accessibilityState={{ checked: addrLabel === l }}>
                      <Text style={[styles.chipText, addrLabel === l && styles.chipTextSelected]}>{l}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Places search → auto-fill */}
                <FieldLabel label="Search your address" required />
                <Text style={styles.fieldHint}>Type a street, area or landmark to auto-fill</Text>
                <PlacesInput
                  placeholder="e.g. MG Road, Bangalore…"
                  iconName="search-outline"
                  onSelect={handleAddressSelect}
                />

                {addressFilled && (
                  <View style={styles.autoFilledBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                    <Text style={styles.autoFilledText}>Address auto-filled — edit below if needed</Text>
                  </View>
                )}

                <FieldLabel label="Flat / House no." />
                <TextInput style={styles.input} placeholder="e.g. 42B" placeholderTextColor={colors.textSecondary}
                  value={house} onChangeText={setHouse} returnKeyType="next" accessibilityLabel="House number" />

                <FieldLabel label="Street / Road" />
                <TextInput style={styles.input} placeholder="e.g. MG Road" placeholderTextColor={colors.textSecondary}
                  value={street} onChangeText={setStreet} returnKeyType="next" accessibilityLabel="Street" />

                <FieldLabel label="Locality / Area" />
                <TextInput style={styles.input} placeholder="e.g. Koramangala" placeholderTextColor={colors.textSecondary}
                  value={locality} onChangeText={setLocality} returnKeyType="next" accessibilityLabel="Locality" />

                <FieldLabel label="City" required />
                <TextInput style={styles.input} placeholder="e.g. Bangalore" placeholderTextColor={colors.textSecondary}
                  value={city} onChangeText={(t) => { clearError(); setCity(t); }} returnKeyType="next" accessibilityLabel="City" />

                <FieldLabel label="State" required />
                <Pressable style={[styles.input, styles.row]} onPress={() => setShowStateList((v) => !v)}
                  accessibilityRole="combobox" accessibilityLabel="Select state">
                  <Text style={[styles.inputText, !state && styles.placeholder]}>{state || "Select state"}</Text>
                  <Ionicons name={showStateList ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                </Pressable>

                {showStateList && (
                  <View style={styles.stateList}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {INDIAN_STATES.map((s) => (
                        <Pressable key={s} style={[styles.stateItem, state === s && styles.stateItemSelected]}
                          onPress={() => { setState(s); setShowStateList(false); clearError(); }}
                          accessibilityRole="menuitem" accessibilityState={{ selected: state === s }}>
                          <Text style={{ fontFamily: fonts.jostRegular, fontSize: 14, color: state === s ? colors.primary : colors.textPrimary }}>{s}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <FieldLabel label="Pincode" required />
                <TextInput
                  style={[styles.input, pincode.length > 0 && !/^\d{6}$/.test(pincode) && styles.inputError]}
                  placeholder="6-digit pincode" placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad" maxLength={6} value={pincode}
                  onChangeText={(t) => { clearError(); setPincode(t.replace(/\D/g, "")); }}
                  returnKeyType="done" accessibilityLabel="Pincode"
                />
                {pincode.length > 0 && !/^\d{6}$/.test(pincode) && (
                  <Text style={styles.fieldError}>Must be exactly 6 digits</Text>
                )}
              </View>
            )}

            {/* ── Step 2: Location ──────────────────────────────── */}
            {step === 2 && (
              <View style={styles.section}>

                <FieldLabel label="Search your location" />
                <Text style={styles.fieldHint}>Search an area or tap the map to pin your location</Text>
                <PlacesInput
                  placeholder="e.g. Koramangala, Bangalore"
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
                    {locationCoords && <Marker coordinate={locationCoords} pinColor={colors.primary} />}
                  </MapView>

                  {/* Auto-detect button */}
                  <Pressable
                    style={({ pressed }) => [styles.autoDetectBtn, pressed && { opacity: 0.85 }]}
                    onPress={handleRequestLocation}
                    disabled={locationLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Auto-detect my location"
                  >
                    {locationLoading
                      ? <ActivityIndicator color={colors.primary} size="small" />
                      : <>
                          <Ionicons name="locate" size={15} color={colors.primary} />
                          <Text style={styles.autoDetectText}>Auto-detect</Text>
                        </>}
                  </Pressable>
                </View>

                {/* Location confirmed */}
                {locationStatus === "granted" && locationCoords && (
                  <View style={styles.locationInfoCard}>
                    <View style={styles.locationInfoHeader}>
                      <Ionicons name="location" size={16} color="#15803D" />
                      <Text style={styles.locationInfoTitle}>Location set</Text>
                    </View>
                    {locationAddress && <Text style={styles.locationInfoAddr}>{locationAddress}</Text>}
                    <Text style={styles.locationInfoCoords}>
                      {locationCoords.latitude.toFixed(5)}, {locationCoords.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}

                {locationStatus === "denied" && (
                  <View style={styles.deniedCard}>
                    <Ionicons name="warning-outline" size={16} color="#B91C1C" />
                    <Text style={styles.deniedText}>Permission denied. Search above or tap the map.</Text>
                  </View>
                )}

                <Text style={styles.skipNote}>
                  Location is optional — tap{" "}
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
                <Pressable style={styles.secondaryBtn} onPress={handleBack} disabled={loading}
                  accessibilityRole="button" accessibilityLabel="Back">
                  <Ionicons name="arrow-back" size={16} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </Pressable>
              )}

              {step < 2 ? (
                <Pressable
                  style={[styles.primaryBtn, ((step === 0 && !step0Valid) || (step === 1 && !step1Valid)) && styles.primaryBtnDisabled, step === 0 && { flex: 1 }]}
                  onPress={handleNext}
                  disabled={(step === 0 && !step0Valid) || (step === 1 && !step1Valid)}
                  accessibilityRole="button" accessibilityLabel="Continue"
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.white} style={{ marginLeft: 4 }} />
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={handleSubmit} disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={locationStatus === "granted" ? "Save profile" : "Skip & save"}
                >
                  {loading ? <ActivityIndicator color={colors.white} /> : (
                    <>
                      <Ionicons
                        name={locationStatus === "granted" ? "checkmark-circle-outline" : "play-skip-forward-outline"}
                        size={16} color={colors.white} style={{ marginRight: 6 }}
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
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radii.sm,
    borderWidth: 1.5, borderColor: colors.navInactive + "66",
    paddingHorizontal: spacing.md, height: 46,
  },
  icon: { marginRight: spacing.xs },
  input: { flex: 1, fontFamily: fonts.jostRegular, fontSize: 15, color: colors.textPrimary, paddingVertical: 0 },
  endIcon: { marginLeft: spacing.xs },
  suggestionList: {
    backgroundColor: colors.white, borderWidth: 1, borderTopWidth: 0,
    borderColor: colors.navInactive + "55",
    borderBottomLeftRadius: radii.sm, borderBottomRightRadius: radii.sm,
    overflow: "hidden", elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  suggestionRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  rowPressed: { backgroundColor: colors.surface },
  mainText: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textPrimary },
  subText: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  separator: { height: 1, backgroundColor: colors.navInactive + "33", marginHorizontal: spacing.md },
});

const stepStyles = StyleSheet.create({
  wrapper: {
    flexDirection: "row", alignItems: "flex-start",
    marginBottom: spacing.md, paddingHorizontal: spacing.sm,
  },
  item: { flex: 1, alignItems: "center", position: "relative" },
  lineTrack: {
    position: "absolute", top: CIRCLE / 2 - 1,
    left: -35, right: "50%", height: 2, overflow: "hidden",
  },
  lineFill: { flex: 1, backgroundColor: colors.navInactive + "99" },
  lineFillDone: { backgroundColor: colors.primary },
  dot: {
    width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.navInactive, zIndex: 1,
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotLabel: { fontFamily: fonts.oswaldSemiBold, fontSize: 13, color: colors.navInactive },
  dotLabelActive: { color: colors.white },
  stepText: { fontFamily: fonts.jostRegular, fontSize: 10, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  stepTextActive: { fontFamily: fonts.jostSemiBold, color: colors.primary },
});

const fldStyles = StyleSheet.create({
  label: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  required: { color: "#EF4444" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },

  hero: {
    flex: 1, backgroundColor: colors.primary,
    paddingTop: 64, paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 16, overflow: "hidden", justifyContent: "flex-end",
  },
  appName: { fontFamily: fonts.jostSemiBold, fontSize: 13, color: "rgba(255,255,255,0.7)", letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.sm },
  heroTitle: { fontFamily: fonts.oswaldBold, fontSize: 30, color: colors.white, lineHeight: 38, letterSpacing: 0.3 },
  heroSub: { fontFamily: fonts.jostRegular, fontSize: 14, color: "rgba(255,255,255,0.65)", marginTop: spacing.xs, lineHeight: 20 },

  triTopRight:      { position: "absolute", top: -30,  right: -30, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 140, borderBottomWidth: 140, borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.07)" },
  triTopRightInner: { position: "absolute", top: 10,   right: 10,  width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 90,  borderBottomWidth: 90,  borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.05)" },
  triBottomLeft:    { position: "absolute", bottom: 28, left: -20,  width: 0, height: 0, borderStyle: "solid", borderRightWidth: 110, borderTopWidth: 110,   borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)" },
  triMidRight:      { position: "absolute", top: "42%", right: 30,  width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 50,  borderBottomWidth: 50,  borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.08)", transform: [{ rotate: "20deg" }] },
  triMidLeft:       { position: "absolute", top: "30%", left: 20,   width: 0, height: 0, borderStyle: "solid", borderRightWidth: 36, borderTopWidth: 36,    borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.05)",    transform: [{ rotate: "-15deg" }] },
  triBottomRight:   { position: "absolute", bottom: -30, right: -30, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 130, borderTopWidth: 130,   borderLeftColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)",   transform: [{ rotate: "-5deg" }] },

  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg + 8, borderTopRightRadius: radii.lg + 8,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, marginTop: -28, flex: 2,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.45, shadowRadius: 18, elevation: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: spacing.md },
  scroll: { paddingBottom: spacing.xl },
  section: { gap: spacing.sm },

  input: {
    fontFamily: fonts.jostRegular, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md - 2,
    borderWidth: 1.5, borderColor: colors.navInactive + "66",
  },
  inputError: { borderColor: "#EF4444" },
  inputText: { fontFamily: fonts.jostRegular, fontSize: 15, color: colors.textPrimary, flex: 1 },
  placeholder: { color: colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  fieldHint: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: -spacing.xs, lineHeight: 16 },
  fieldError: { fontFamily: fonts.jostRegular, color: "#EF4444", fontSize: 12, marginTop: -spacing.xs },

  autoFilledBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#DCFCE7", borderRadius: radii.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderWidth: 1, borderColor: "#86EFAC",
  },
  autoFilledText: { fontFamily: fonts.jostMedium, fontSize: 12, color: "#15803D", flex: 1 },

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
    position: "absolute", bottom: 12, right: 12,
    backgroundColor: colors.white, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
    borderWidth: 1, borderColor: colors.primary + "33",
  },
  autoDetectText: { fontFamily: fonts.jostSemiBold, fontSize: 13, color: colors.primary },

  locationInfoCard: { borderRadius: radii.md, padding: spacing.md, gap: 4, borderWidth: 1.5, borderColor: "#86EFAC", backgroundColor: "#DCFCE7" },
  locationInfoHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationInfoTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: "#15803D" },
  locationInfoAddr: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  locationInfoCoords: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary },

  deniedCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: radii.md, padding: spacing.md, borderWidth: 1.5, borderColor: "#FCA5A5", backgroundColor: "#FEE2E2" },
  deniedText: { fontFamily: fonts.jostRegular, fontSize: 13, color: "#B91C1C", lineHeight: 18, flex: 1 },

  skipNote: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, lineHeight: 18, textAlign: "center", marginTop: spacing.sm },

  errorBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEE2E2", borderRadius: radii.sm, padding: spacing.md, marginTop: spacing.sm },
  errorBannerText: { fontFamily: fonts.jostMedium, color: "#991B1B", fontSize: 13, flex: 1 },

  navRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radii.md,
    paddingVertical: spacing.md, alignItems: "center", justifyContent: "center", flexDirection: "row",
    shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontFamily: fonts.jakartaBold, color: colors.white, fontSize: 15, letterSpacing: 0.3 },
  secondaryBtn: {
    borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    alignItems: "center", justifyContent: "center", flexDirection: "row",
    borderWidth: 1.5, borderColor: colors.navInactive, backgroundColor: colors.surface,
  },
  secondaryBtnText: { fontFamily: fonts.jostMedium, fontSize: 15, color: colors.textSecondary },
});
