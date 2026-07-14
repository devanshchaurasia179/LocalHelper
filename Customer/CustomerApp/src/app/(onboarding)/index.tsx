import { useState, useCallback } from "react";
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
import { router } from "expo-router";

import { useCompleteProfile } from "@/hooks/useCompleteProfile";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/constants/theme";
import { Spacing } from "@/constants/theme";
import { ROUTES } from "@/constants/routes";

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const theme = useTheme();
  return (
    <View style={stepStyles.row} accessibilityRole="progressbar">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={stepStyles.item}>
            <View
              style={[
                stepStyles.dot,
                done && stepStyles.dotDone,
                active && stepStyles.dotActive,
                !done && !active && { backgroundColor: theme.backgroundElement },
              ]}
            >
              {done ? (
                <Text style={stepStyles.check}>✓</Text>
              ) : (
                <Text
                  style={[
                    stepStyles.dotLabel,
                    { color: active ? "#fff" : theme.textSecondary },
                  ]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                stepStyles.stepText,
                { color: active ? theme.text : theme.textSecondary },
                active && stepStyles.stepTextActive,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function FieldLabel({
  label,
  required,
  textColor,
}: {
  label: string;
  required?: boolean;
  textColor: string;
}) {
  return (
    <Text style={[fieldStyles.label, { color: textColor }]}>
      {label}
      {required && <Text style={fieldStyles.required}> *</Text>}
    </Text>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const theme = useTheme();
  const { patchCustomer } = useAuth();
  const { complete, loading, error, clearError } = useCompleteProfile();

  const [step, setStep] = useState<Step>(0);

  // ── Step 0: Personal Info ──────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string | null>(null);

  // ── Step 1: Address ────────────────────────────────────────────────────────
  const [label, setLabel] = useState("Home");
  const [house, setHouse] = useState("");
  const [street, setStreet] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [showStateList, setShowStateList] = useState(false);

  // ── Step 2: Location ───────────────────────────────────────────────────────
  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "granted" | "denied"
  >("idle");

  // ── Validation ─────────────────────────────────────────────────────────────

  const step0Valid = name.trim().length >= 2 && gender !== null;
  const step1Valid =
    city.trim().length > 0 &&
    state.trim().length > 0 &&
    /^\d{6}$/.test(pincode);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleNext = () => {
    clearError();
    if (step < 2) setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => {
    clearError();
    if (step > 0) setStep((s) => (s - 1) as Step);
  };

  const handleRequestLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus("denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocationCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setLocationStatus("granted");
    } catch {
      Alert.alert("Location Error", "Could not fetch your location.");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const success = await complete({
      name: name.trim(),
      gender: gender!,
      address: {
        label: label.trim() || "Home",
        house: house.trim(),
        street: street.trim(),
        locality: locality.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
      },
      location: locationCoords ?? undefined,
    });

    if (success) {
      patchCustomer({ isOnboarded: true });
      router.replace(ROUTES.APP.HOME as any);
    }
  }, [complete, name, gender, label, house, street, locality, city, state, pincode, locationCoords, patchCustomer]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Set up your profile
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              A few quick details and you're ready to go.
            </Text>
          </View>

          {/* Step indicator */}
          <StepIndicator current={step} />

          {/* ── Step 0: Personal Info ──────────────────────────────────── */}
          {step === 0 && (
            <View style={styles.section}>
              <FieldLabel label="Full name" required textColor={theme.text} />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                  },
                ]}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={(t) => {
                  clearError();
                  setName(t);
                }}
                autoCapitalize="words"
                returnKeyType="done"
                accessibilityLabel="Full name"
              />

              <FieldLabel
                label="Gender"
                required
                textColor={theme.text}
              />
              <View style={styles.chipRow}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.backgroundElement },
                      gender === g && styles.chipSelected,
                    ]}
                    onPress={() => {
                      clearError();
                      setGender(g);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: gender === g }}
                    accessibilityLabel={g}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: gender === g ? "#fff" : theme.text },
                      ]}
                    >
                      {g}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ── Step 1: Address ───────────────────────────────────────── */}
          {step === 1 && (
            <View style={styles.section}>
              <FieldLabel label="Address label" textColor={theme.text} />
              <View style={styles.chipRow}>
                {["Home", "Work", "Other"].map((l) => (
                  <Pressable
                    key={l}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.backgroundElement },
                      label === l && styles.chipSelected,
                    ]}
                    onPress={() => setLabel(l)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: label === l }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: label === l ? "#fff" : theme.text },
                      ]}
                    >
                      {l}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <FieldLabel label="Flat / House no." textColor={theme.text} />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                  },
                ]}
                placeholder="e.g. 42B"
                placeholderTextColor={theme.textSecondary}
                value={house}
                onChangeText={setHouse}
                returnKeyType="next"
                accessibilityLabel="House number"
              />

              <FieldLabel label="Street / Road" textColor={theme.text} />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                  },
                ]}
                placeholder="e.g. MG Road"
                placeholderTextColor={theme.textSecondary}
                value={street}
                onChangeText={setStreet}
                returnKeyType="next"
                accessibilityLabel="Street"
              />

              <FieldLabel label="Locality / Area" textColor={theme.text} />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                  },
                ]}
                placeholder="e.g. Koramangala"
                placeholderTextColor={theme.textSecondary}
                value={locality}
                onChangeText={setLocality}
                returnKeyType="next"
                accessibilityLabel="Locality"
              />

              <FieldLabel label="City" required textColor={theme.text} />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                  },
                ]}
                placeholder="e.g. Bangalore"
                placeholderTextColor={theme.textSecondary}
                value={city}
                onChangeText={(t) => {
                  clearError();
                  setCity(t);
                }}
                returnKeyType="next"
                accessibilityLabel="City"
              />

              <FieldLabel label="State" required textColor={theme.text} />
              <Pressable
                style={[
                  styles.input,
                  styles.dropdown,
                  { backgroundColor: theme.backgroundElement },
                ]}
                onPress={() => setShowStateList((v) => !v)}
                accessibilityRole="combobox"
                accessibilityLabel="Select state"
              >
                <Text
                  style={{
                    color: state ? theme.text : theme.textSecondary,
                    fontSize: 16,
                  }}
                >
                  {state || "Select state"}
                </Text>
                <Text style={{ color: theme.textSecondary }}>
                  {showStateList ? "▲" : "▼"}
                </Text>
              </Pressable>

              {showStateList && (
                <View
                  style={[
                    styles.stateList,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <ScrollView
                    style={{ maxHeight: 200 }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {INDIAN_STATES.map((s) => (
                      <Pressable
                        key={s}
                        style={[
                          styles.stateItem,
                          state === s && {
                            backgroundColor: theme.backgroundSelected,
                          },
                        ]}
                        onPress={() => {
                          setState(s);
                          setShowStateList(false);
                          clearError();
                        }}
                        accessibilityRole="menuitem"
                        accessibilityState={{ selected: state === s }}
                      >
                        <Text style={{ color: theme.text }}>{s}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <FieldLabel label="Pincode" required textColor={theme.text} />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                  },
                  pincode.length > 0 &&
                    !/^\d{6}$/.test(pincode) &&
                    styles.inputError,
                ]}
                placeholder="6-digit pincode"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
                value={pincode}
                onChangeText={(t) => {
                  clearError();
                  setPincode(t.replace(/\D/g, ""));
                }}
                returnKeyType="done"
                accessibilityLabel="Pincode"
              />
              {pincode.length > 0 && !/^\d{6}$/.test(pincode) && (
                <Text style={styles.fieldError}>
                  Must be exactly 6 digits
                </Text>
              )}
            </View>
          )}

          {/* ── Step 2: Location ──────────────────────────────────────── */}
          {step === 2 && (
            <View style={styles.section}>
              <View style={styles.locationCard}>
                <Text style={[styles.locationTitle, { color: theme.text }]}>
                  {locationStatus === "granted"
                    ? "📍 Location captured"
                    : "Share your location"}
                </Text>
                <Text
                  style={[
                    styles.locationDesc,
                    { color: theme.textSecondary },
                  ]}
                >
                  {locationStatus === "granted"
                    ? `Lat: ${locationCoords!.latitude.toFixed(5)}  ·  Long: ${locationCoords!.longitude.toFixed(5)}`
                    : locationStatus === "denied"
                    ? "Permission denied. You can skip this step — location can be updated later."
                    : "Helps us show nearby service providers faster. You can skip this and update it later."}
                </Text>

                {locationStatus !== "granted" && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.locationButton,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={handleRequestLocation}
                    disabled={locationLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Use current location"
                  >
                    {locationLoading ? (
                      <ActivityIndicator color="#2563EB" />
                    ) : (
                      <Text style={styles.locationButtonText}>
                        Use current location
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>

              <Text
                style={[styles.skipNote, { color: theme.textSecondary }]}
              >
                Location is optional — tap{" "}
                <Text style={{ fontWeight: "600" }}>
                  {locationStatus === "granted" ? "Save profile" : "Skip & save"}
                </Text>{" "}
                to continue without it.
              </Text>
            </View>
          )}

          {/* ── Error banner ──────────────────────────────────────────── */}
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          {/* ── Navigation buttons ────────────────────────────────────── */}
          <View style={styles.navRow}>
            {step > 0 && (
              <Pressable
                style={[
                  styles.secondaryBtn,
                  { backgroundColor: theme.backgroundElement },
                ]}
                onPress={handleBack}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                  ← Back
                </Text>
              </Pressable>
            )}

            {step < 2 ? (
              <Pressable
                style={[
                  styles.primaryBtn,
                  step === 0 && !step0Valid && styles.primaryBtnDisabled,
                  step === 1 && !step1Valid && styles.primaryBtnDisabled,
                  step === 0 && { flex: 1 },
                ]}
                onPress={handleNext}
                disabled={
                  (step === 0 && !step0Valid) || (step === 1 && !step1Valid)
                }
                accessibilityRole="button"
                accessibilityLabel="Continue"
              >
                <Text style={styles.primaryBtnText}>Continue →</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.primaryBtn,
                  loading && styles.primaryBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  locationStatus === "granted" ? "Save profile" : "Skip & save"
                }
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {locationStatus === "granted"
                      ? "Save profile"
                      : "Skip & save"}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.four,
    marginVertical: Spacing.four,
  },
  item: { alignItems: "center", gap: Spacing.one },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dotActive: { backgroundColor: "#2563EB" },
  dotDone: { backgroundColor: "#16A34A" },
  dotLabel: { fontSize: 13, fontWeight: "700" },
  check: { color: "#fff", fontSize: 14, fontWeight: "700" },
  stepText: { fontSize: 11 },
  stepTextActive: { fontWeight: "600" },
});

const fieldStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  required: { color: "#EF4444" },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  header: {
    marginTop: Spacing.four,
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },

  section: { gap: Spacing.two },

  input: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  inputError: { borderWidth: 1.5, borderColor: "#EF4444" },

  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  stateList: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: -Spacing.one,
  },
  stateItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
  chipSelected: { backgroundColor: "#2563EB" },
  chipText: { fontSize: 14, fontWeight: "500" },

  fieldError: { color: "#EF4444", fontSize: 12, marginTop: -Spacing.one },

  locationCard: {
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#2563EB22",
  },
  locationTitle: { fontSize: 17, fontWeight: "700" },
  locationDesc: { fontSize: 14, lineHeight: 20 },
  locationButton: {
    borderWidth: 1.5,
    borderColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: Spacing.two + 4,
    alignItems: "center",
    marginTop: Spacing.one,
  },
  locationButtonText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 15,
  },
  skipNote: { fontSize: 12, lineHeight: 18, textAlign: "center" },

  errorBanner: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  errorBannerText: { color: "#991B1B", fontSize: 13 },

  navRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 16, fontWeight: "500" },
});
