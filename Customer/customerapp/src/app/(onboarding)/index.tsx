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
import { ROUTES } from "@/constants/routes";
import { colors, spacing, radii, typography, fonts } from "@/app/(tabs)/home/theme";

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

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <View style={stepStyles.row} accessibilityRole="progressbar">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={stepStyles.item}>
            {/* connector line before each step except first */}
            {i > 0 && (
              <View style={[stepStyles.line, done && stepStyles.lineDone]} />
            )}
            <View
              style={[
                stepStyles.dot,
                active && stepStyles.dotActive,
                done && stepStyles.dotDone,
              ]}
            >
              {done ? (
                <Text style={stepStyles.check}>✓</Text>
              ) : (
                <Text style={[stepStyles.dotLabel, active && stepStyles.dotLabelActive]}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={[stepStyles.stepText, active && stepStyles.stepTextActive]}>
              {label}
            </Text>
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

export default function OnboardingScreen() {
  const { patchCustomer } = useAuth();
  const { complete, loading, error, clearError } = useCompleteProfile();

  const [step, setStep] = useState<Step>(0);

  // Step 0: Personal Info
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string | null>(null);

  // Step 1: Address
  const [label, setLabel] = useState("Home");
  const [house, setHouse] = useState("");
  const [street, setStreet] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [showStateList, setShowStateList] = useState(false);

  // Step 2: Location
  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");

  // Validation
  const step0Valid = name.trim().length >= 2 && gender !== null;
  const step1Valid =
    city.trim().length > 0 &&
    state.trim().length > 0 &&
    /^\d{6}$/.test(pincode);

  const handleNext = () => { clearError(); if (step < 2) setStep((s) => (s + 1) as Step); };
  const handleBack = () => { clearError(); if (step > 0) setStep((s) => (s - 1) as Step); };

  const handleRequestLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationStatus("denied"); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* ── Hero band ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Decorative triangles */}
          <View style={styles.triTopRight}      pointerEvents="none" />
          <View style={styles.triTopRightInner} pointerEvents="none" />
          <View style={styles.triBottomLeft}    pointerEvents="none" />
          <View style={styles.triMidRight}      pointerEvents="none" />
          <View style={styles.triMidLeft}       pointerEvents="none" />
          <View style={styles.triBottomRight}   pointerEvents="none" />

          <Text style={styles.appName}>LocalHelpers</Text>
          <Text style={styles.heroTitle}>Complete your{"\n"}profile</Text>
          <Text style={styles.heroSub}>A few quick details and you're ready to go</Text>
        </View>

        {/* ── White content card ─────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.handle} />

          {/* Step indicator inside card */}
          <StepIndicator current={step} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {/* ── Step 0: Personal Info ──────────────────────────── */}
            {step === 0 && (
              <View style={styles.section}>
                <FieldLabel label="Full name" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={colors.textSecondary}
                  value={name}
                  onChangeText={(t: string) => { clearError(); setName(t); }}
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
                      <Text style={[styles.chipText, gender === g && styles.chipTextSelected]}>
                        {g}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* ── Step 1: Address ────────────────────────────────────── */}
            {step === 1 && (
              <View style={styles.section}>
                <FieldLabel label="Address label" />
                <View style={styles.chipRow}>
                  {["Home", "Work", "Other"].map((l) => (
                    <Pressable
                      key={l}
                      style={[styles.chip, label === l && styles.chipSelected]}
                      onPress={() => setLabel(l)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: label === l }}
                    >
                      <Text style={[styles.chipText, label === l && styles.chipTextSelected]}>{l}</Text>
                    </Pressable>
                  ))}
                </View>

                <FieldLabel label="Flat / House no." />
                <TextInput style={styles.input} placeholder="e.g. 42B" placeholderTextColor={colors.textSecondary} value={house} onChangeText={setHouse} returnKeyType="next" accessibilityLabel="House number" />

                <FieldLabel label="Street / Road" />
                <TextInput style={styles.input} placeholder="e.g. MG Road" placeholderTextColor={colors.textSecondary} value={street} onChangeText={setStreet} returnKeyType="next" accessibilityLabel="Street" />

                <FieldLabel label="Locality / Area" />
                <TextInput style={styles.input} placeholder="e.g. Koramangala" placeholderTextColor={colors.textSecondary} value={locality} onChangeText={setLocality} returnKeyType="next" accessibilityLabel="Locality" />

                <FieldLabel label="City" required />
                <TextInput style={styles.input} placeholder="e.g. Bangalore" placeholderTextColor={colors.textSecondary} value={city} onChangeText={(t: string) => { clearError(); setCity(t); }} returnKeyType="next" accessibilityLabel="City" />

                <FieldLabel label="State" required />
                <Pressable
                  style={[styles.input, styles.dropdown]}
                  onPress={() => setShowStateList((v) => !v)}
                  accessibilityRole="combobox"
                  accessibilityLabel="Select state"
                >
                  <Text style={{ fontFamily: fonts.jostRegular, fontSize: 15, color: state ? colors.textPrimary : colors.textSecondary }}>
                    {state || "Select state"}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>{showStateList ? "▲" : "▼"}</Text>
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
                          <Text style={{ fontFamily: fonts.jostRegular, fontSize: 14, color: state === s ? colors.primary : colors.textPrimary }}>{s}</Text>
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
                  onChangeText={(t: string) => { clearError(); setPincode(t.replace(/\D/g, "")); }}
                  returnKeyType="done"
                  accessibilityLabel="Pincode"
                />
                {pincode.length > 0 && !/^\d{6}$/.test(pincode) && (
                  <Text style={styles.fieldError}>Must be exactly 6 digits</Text>
                )}
              </View>
            )}

            {/* ── Step 2: Location ───────────────────────────────────── */}
            {step === 2 && (
              <View style={styles.section}>
                <View style={styles.locationCard}>
                  <Text style={styles.locationTitle}>
                    {locationStatus === "granted" ? "📍 Location captured" : "📍 Share your location"}
                  </Text>
                  <Text style={styles.locationDesc}>
                    {locationStatus === "granted"
                      ? `Lat: ${locationCoords!.latitude.toFixed(5)}  ·  Long: ${locationCoords!.longitude.toFixed(5)}`
                      : locationStatus === "denied"
                      ? "Permission denied. You can skip this step — location can be updated later."
                      : "Helps us show nearby service providers faster. You can skip this and update it later."}
                  </Text>
                  {locationStatus !== "granted" && (
                    <Pressable
                      style={({ pressed }) => [styles.locationBtn, pressed && { opacity: 0.8 }]}
                      onPress={handleRequestLocation}
                      disabled={locationLoading}
                      accessibilityRole="button"
                      accessibilityLabel="Use current location"
                    >
                      {locationLoading
                        ? <ActivityIndicator color={colors.primary} />
                        : <Text style={styles.locationBtnText}>Use current location</Text>}
                    </Pressable>
                  )}
                </View>
                <Text style={styles.skipNote}>
                  Location is optional — tap{" "}
                  <Text style={{ fontFamily: fonts.jostSemiBold, color: colors.primary }}>
                    {locationStatus === "granted" ? "Save profile" : "Skip & save"}
                  </Text>{" "}
                  to continue without it.
                </Text>
              </View>
            )}

            {/* ── Error banner ────────────────────────────────────────── */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* ── Navigation buttons ──────────────────────────────────── */}
            <View style={styles.navRow}>
              {step > 0 && (
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={handleBack}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <Text style={styles.secondaryBtnText}>← Back</Text>
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
                  <Text style={styles.primaryBtnText}>Continue →</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={locationStatus === "granted" ? "Save profile" : "Skip & save"}
                >
                  {loading
                    ? <ActivityIndicator color={colors.white} />
                    : <Text style={styles.primaryBtnText}>{locationStatus === "granted" ? "Save profile" : "Skip & save"}</Text>}
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

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  item: { alignItems: "center", gap: spacing.xs, flex: 1 },
  line: {
    position: "absolute",
    top: 16,
    left: "-50%",
    right: "50%",
    height: 2,
    backgroundColor: colors.navInactive,
  },
  lineDone: { backgroundColor: colors.primary },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.navInactive,
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotLabel: { fontFamily: fonts.oswaldSemiBold, fontSize: 13, color: colors.navInactive },
  dotLabelActive: { color: colors.white },
  check: { fontFamily: fonts.jakartaBold, color: colors.white, fontSize: 14 },
  stepText: { fontFamily: fonts.jostRegular, fontSize: 10, color: colors.textSecondary, textAlign: "center" },
  stepTextActive: { fontFamily: fonts.jostSemiBold, color: colors.primary },
});

const fieldStyles = StyleSheet.create({
  label: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  required: { color: "#EF4444" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },

  // Hero band
  hero: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingTop: 64,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl + 16,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  appName: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontFamily: fonts.oswaldBold,
    fontSize: 30,
    color: colors.white,
    lineHeight: 38,
    letterSpacing: 0.3,
  },
  heroSub: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  // Decorative triangles (same as send-otp)
  triTopRight: { position: "absolute", top: -30, right: -30, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 140, borderBottomWidth: 140, borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.07)" },
  triTopRightInner: { position: "absolute", top: 10, right: 10, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 90, borderBottomWidth: 90, borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.05)" },
  triBottomLeft: { position: "absolute", bottom: 28, left: -20, width: 0, height: 0, borderStyle: "solid", borderRightWidth: 110, borderTopWidth: 110, borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)" },
  triMidRight: { position: "absolute", top: "42%", right: 30, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 50, borderBottomWidth: 50, borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.08)", transform: [{ rotate: "20deg" }] },
  triMidLeft: { position: "absolute", top: "30%", left: 20, width: 0, height: 0, borderStyle: "solid", borderRightWidth: 36, borderTopWidth: 36, borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.05)", transform: [{ rotate: "-15deg" }] },
  triBottomRight: { position: "absolute", bottom: -30, right: -30, width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 130, borderTopWidth: 130, borderLeftColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)", transform: [{ rotate: "-5deg" }] },

  // White card
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    paddingHorizontal: spacing.md,
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

  // Input
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
  dropdown: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  stateList: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "44",
    overflow: "hidden",
    marginTop: -spacing.sm,
  },
  stateItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  stateItemSelected: { backgroundColor: colors.primary + "14" },

  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.navInactive,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textSecondary },
  chipTextSelected: { color: colors.white },

  fieldError: { fontFamily: fonts.jostRegular, color: "#EF4444", fontSize: 12, marginTop: -spacing.xs },

  // Location step
  locationCard: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary + "33",
    backgroundColor: colors.primary + "08",
  },
  locationTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 16, color: colors.textPrimary },
  locationDesc: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  locationBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  locationBtnText: { fontFamily: fonts.jostSemiBold, color: colors.primary, fontSize: 14 },
  skipNote: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, lineHeight: 18, textAlign: "center", marginTop: spacing.sm },

  // Error banner
  errorBanner: { backgroundColor: "#FEE2E2", borderRadius: radii.sm, padding: spacing.md, marginTop: spacing.sm },
  errorBannerText: { fontFamily: fonts.jostMedium, color: "#991B1B", fontSize: 13 },

  // Navigation
  navRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontFamily: fonts.jakartaBold, color: colors.white, fontSize: 15, letterSpacing: 0.3 },
  secondaryBtn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.navInactive,
    backgroundColor: colors.surface,
  },
  secondaryBtnText: { fontFamily: fonts.jostMedium, fontSize: 15, color: colors.textSecondary },
});
