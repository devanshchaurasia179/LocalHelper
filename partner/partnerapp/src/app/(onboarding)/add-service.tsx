import { useState, useCallback, useEffect } from "react";
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

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/api";
import { useAuth } from "@/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";
import { colors, spacing, radii, fonts } from "@/constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { _id: string; name: string; description?: string; icon?: string };
type WorkingDay = { day: string; startTime: string; endTime: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] as const;

const LANGUAGES = ["Hindi","English","Tamil","Telugu","Kannada","Bengali","Marathi","Gujarati"] as const;

// ─── Field Label ──────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={fieldStyles.label}>
      {label}{required && <Text style={fieldStyles.required}> *</Text>}
    </Text>
  );
}

const fieldStyles = StyleSheet.create({
  label: {
    fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary,
    marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5,
  },
  required: { color: "#EF4444" },
});

// ─── Working Day Row ──────────────────────────────────────────────────────────

function WorkingDayRow({
  day, entry, onAdd, onRemove, onChange,
}: {
  day: string;
  entry: WorkingDay | undefined;
  onAdd: (d: string) => void;
  onRemove: (d: string) => void;
  onChange: (d: string, f: "startTime" | "endTime", v: string) => void;
}) {
  const active = !!entry;
  return (
    <View style={wdStyles.row}>
      <Pressable
        style={[wdStyles.dayChip, active && wdStyles.dayChipActive]}
        onPress={() => active ? onRemove(day) : onAdd(day)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: active }}
      >
        <Text style={[wdStyles.dayText, active && wdStyles.dayTextActive]}>
          {day.slice(0, 3)}
        </Text>
      </Pressable>
      {active && (
        <View style={wdStyles.timePair}>
          <TextInput
            style={wdStyles.timeInput}
            value={entry!.startTime}
            onChangeText={(v) => onChange(day, "startTime", v)}
            placeholder="09:00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            accessibilityLabel={`${day} start time`}
          />
          <Text style={wdStyles.timeSep}>–</Text>
          <TextInput
            style={wdStyles.timeInput}
            value={entry!.endTime}
            onChangeText={(v) => onChange(day, "endTime", v)}
            placeholder="18:00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            accessibilityLabel={`${day} end time`}
          />
        </View>
      )}
    </View>
  );
}

const wdStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  dayChip: {
    width: 44, height: 36, borderRadius: radii.sm, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.navInactive, backgroundColor: colors.surface,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontFamily: fonts.jostMedium, fontSize: 11, color: colors.textSecondary },
  dayTextActive: { color: colors.white },
  timePair: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  timeInput: {
    flex: 1, height: 36, borderRadius: radii.sm, borderWidth: 1.5,
    borderColor: colors.navInactive + "88", paddingHorizontal: spacing.sm,
    fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textPrimary,
    backgroundColor: colors.surface, textAlign: "center",
  },
  timeSep: { fontFamily: fonts.jostRegular, color: colors.textSecondary, fontSize: 14 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddServiceScreen() {
  const { patchPartner } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [selectedLangs, setSelectedLangs] = useState<string[]>(["Hindi", "English"]);
  const [bio, setBio] = useState("");
  const [visitingCredits, setVisitingCredits] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [serviceRadius, setServiceRadius] = useState("10");
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);

  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ categories: Category[] }>("/categories")
      .then((res) => setCategories(res.data.categories ?? []))
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false));
  }, []);

  const toggleCat = (id: string) =>
    setSelectedCats((p) => p.includes(id) ? p.filter((c) => c !== id) : [...p, id]);

  const toggleLang = (lang: string) =>
    setSelectedLangs((p) => p.includes(lang) ? p.filter((l) => l !== lang) : [...p, lang]);

  const addDay = (day: string) =>
    setWorkingDays((p) => [...p, { day, startTime: "09:00", endTime: "18:00" }]);

  const removeDay = (day: string) =>
    setWorkingDays((p) => p.filter((d) => d.day !== day));

  const changeTime = (day: string, field: "startTime" | "endTime", value: string) =>
    setWorkingDays((p) => p.map((d) => d.day === day ? { ...d, [field]: value } : d));

  const handleRequestLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationStatus("denied"); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setLocationStatus("granted");
    } catch {
      Alert.alert("Location Error", "Could not fetch your location. You can continue without it.");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const parsedSkills = skills.split(",").map((s) => s.trim()).filter(Boolean);

  const isValid =
    selectedCats.length > 0 &&
    parsedSkills.length > 0 &&
    visitingCredits.trim().length > 0 &&
    !isNaN(Number(visitingCredits)) &&
    Number(visitingCredits) >= 0;

  const handleSubmit = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await api.put("/partner/service/setup", {
        categories: selectedCats,
        skills: parsedSkills,
        experience: experience ? Number(experience) : undefined,
        languages: selectedLangs,
        bio: bio.trim() || undefined,
        visitingCredits: Number(visitingCredits),
        emergencyAvailable: emergency,
        serviceRadius: serviceRadius ? Number(serviceRadius) : 10,
        workingDays: workingDays.length > 0 ? workingDays : undefined,
        serviceLocation: locationCoords
          ? { longitude: locationCoords.longitude, latitude: locationCoords.latitude }
          : undefined,
      });
      patchPartner({ isService: true });
      router.replace(ROUTES.ONBOARDING.DOCUMENTS as any);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedCats, parsedSkills, experience, selectedLangs, bio, visitingCredits, emergency, serviceRadius, workingDays, locationCoords, patchPartner]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>

        {/* ── Hero band ──────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.triTopRight} pointerEvents="none" />
          <View style={styles.triTopRightInner} pointerEvents="none" />
          <View style={styles.triBottomLeft} pointerEvents="none" />
          <View style={styles.triMidRight} pointerEvents="none" />
          <View style={styles.triMidLeft} pointerEvents="none" />
          <View style={styles.triBottomRight} pointerEvents="none" />
          <Text style={styles.appName}>LocalHelpers Partner</Text>
          <Text style={styles.heroTitle}>Set up your{"\n"}service</Text>
          <Text style={styles.heroSub}>Step 2 of 3 — What do you offer?</Text>
        </View>

        {/* ── White card ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.handle} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {/* ── Service Categories ─────────────────────────────────── */}
            <FieldLabel label="Service Categories" required />
            {catLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
            ) : (
              <View style={styles.chipGrid}>
                {categories.map((cat) => {
                  const active = selectedCats.includes(cat._id);
                  return (
                    <Pressable
                      key={cat._id}
                      style={[styles.catChip, active && styles.catChipActive]}
                      onPress={() => { setError(null); toggleCat(cat._id); }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                    >
                      {cat.icon ? (
                        <MaterialCommunityIcons
                          name={cat.icon as any}
                          size={16}
                          color={active ? colors.white : colors.textSecondary}
                        />
                      ) : (
                        <Text style={styles.catIcon}>🛠️</Text>
                      )}
                      <Text style={[styles.catName, active && styles.catNameActive]}>{cat.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* ── Skills ─────────────────────────────────────────────── */}
            <View style={styles.fieldGap}>
              <FieldLabel label="Skills" required />
              <TextInput
                style={styles.input}
                placeholder="e.g. Pipe fitting, Leak repair, Drain cleaning"
                placeholderTextColor={colors.textSecondary}
                value={skills}
                onChangeText={(t) => { setError(null); setSkills(t); }}
                returnKeyType="done"
                accessibilityLabel="Skills (comma separated)"
              />
              <Text style={styles.hint}>Separate multiple skills with commas</Text>
            </View>

            {/* ── Experience ─────────────────────────────────────────── */}
            <View style={styles.fieldGap}>
              <FieldLabel label="Years of experience" />
              <TextInput
                style={styles.input}
                placeholder="e.g. 5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={2}
                value={experience}
                onChangeText={(t) => setExperience(t.replace(/\D/g, ""))}
                accessibilityLabel="Years of experience"
              />
            </View>

            {/* ── Languages ──────────────────────────────────────────── */}
            <View style={styles.fieldGap}>
              <FieldLabel label="Languages spoken" />
              <View style={styles.langRow}>
                {LANGUAGES.map((lang) => {
                  const active = selectedLangs.includes(lang);
                  return (
                    <Pressable
                      key={lang}
                      style={[styles.langChip, active && styles.langChipActive]}
                      onPress={() => toggleLang(lang)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                    >
                      <Text style={[styles.langText, active && styles.langTextActive]}>{lang}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Bio ────────────────────────────────────────────────── */}
            <View style={styles.fieldGap}>
              <FieldLabel label="Short bio" />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell customers a bit about yourself and your work…"
                placeholderTextColor={colors.textSecondary}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                maxLength={300}
                textAlignVertical="top"
                accessibilityLabel="Short bio"
              />
              <Text style={styles.charCount}>{bio.length}/300</Text>
            </View>

            {/* ── Pricing ────────────────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>💰 Pricing & Availability</Text>
            </View>

            <View style={styles.fieldGap}>
              <FieldLabel label="Visiting fee (₹)" required />
              <TextInput
                style={[styles.input, visitingCredits.length > 0 && isNaN(Number(visitingCredits)) && styles.inputError]}
                placeholder="e.g. 150"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={visitingCredits}
                onChangeText={(t) => { setError(null); setVisitingCredits(t.replace(/\D/g, "")); }}
                accessibilityLabel="Visiting fee in rupees"
              />
              <Text style={styles.hint}>Amount charged just to visit the customer's location</Text>
            </View>

            <View style={styles.fieldGap}>
              <FieldLabel label="Service radius (km)" />
              <TextInput
                style={styles.input}
                placeholder="e.g. 10"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={3}
                value={serviceRadius}
                onChangeText={(t) => setServiceRadius(t.replace(/\D/g, ""))}
                accessibilityLabel="Service radius in kilometres"
              />
            </View>

            {/* ── Emergency toggle ───────────────────────────────────── */}
            <Pressable
              style={[styles.toggleRow, emergency && styles.toggleRowActive]}
              onPress={() => setEmergency((e) => !e)}
              accessibilityRole="switch"
              accessibilityState={{ checked: emergency }}
            >
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>🚨 Emergency available</Text>
                <Text style={styles.toggleDesc}>Accept urgent same-day requests (may earn more)</Text>
              </View>
              <View style={[styles.togglePill, emergency && styles.togglePillOn]}>
                <View style={[styles.toggleThumb, emergency && styles.toggleThumbOn]} />
              </View>
            </Pressable>

            {/* ── Working days ───────────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📅 Working Schedule</Text>
              <Text style={styles.sectionSub}>Tap a day to toggle, then set hours</Text>
            </View>

            <View style={styles.fieldGap}>
              {ALL_DAYS.map((day) => (
                <WorkingDayRow
                  key={day}
                  day={day}
                  entry={workingDays.find((d) => d.day === day)}
                  onAdd={addDay}
                  onRemove={removeDay}
                  onChange={changeTime}
                />
              ))}
            </View>

            {/* ── Location ───────────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📍 Service Location</Text>
              <Text style={styles.sectionSub}>Helps customers find you for nearby jobs</Text>
            </View>

            <Pressable
              style={[styles.locationCard, locationStatus === "granted" && styles.locationCardGranted]}
              onPress={locationStatus !== "granted" ? handleRequestLocation : undefined}
              disabled={locationLoading || locationStatus === "granted"}
              accessibilityRole="button"
              accessibilityLabel="Share your location"
            >
              {locationLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : locationStatus === "granted" ? (
                <>
                  <Text style={styles.locationTitle}>✅ Location captured</Text>
                  <Text style={styles.locationDesc}>
                    {`${locationCoords!.latitude.toFixed(5)}, ${locationCoords!.longitude.toFixed(5)}`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.locationTitle}>
                    {locationStatus === "denied" ? "⚠️ Permission denied" : "Tap to share location"}
                  </Text>
                  <Text style={styles.locationDesc}>
                    {locationStatus === "denied"
                      ? "You can still continue — location can be updated from profile later."
                      : "Optional but recommended. Skip to continue without it."}
                  </Text>
                </>
              )}
            </Pressable>

            {/* ── Error banner ───────────────────────────────────────── */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* ── Submit ─────────────────────────────────────────────── */}
            <Pressable
              style={[styles.submitBtn, (!isValid || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || loading}
              accessibilityRole="button"
              accessibilityLabel="Save service details"
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.submitBtnText}>Save & Continue →</Text>}
            </Pressable>

            {!isValid && (
              <Text style={styles.validationNote}>
                Fill in categories, at least one skill and visiting fee to continue.
              </Text>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },

  // ── Hero band ───────────────────────────────────────────────────────────────
  hero: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingTop: 64,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 16,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  appName: {
    fontFamily: fonts.jostSemiBold, fontSize: 13, color: "rgba(255,255,255,0.7)",
    letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.sm,
  },
  heroTitle: {
    fontFamily: fonts.oswaldBold, fontSize: 30, color: colors.white,
    lineHeight: 38, letterSpacing: 0.3,
  },
  heroSub: {
    fontFamily: fonts.jostRegular, fontSize: 14, color: "rgba(255,255,255,0.65)",
    marginTop: spacing.xs, lineHeight: 20,
  },

  // ── Geometric decorations (triangles) ────────────────────────────────────────
  triTopRight: {
    position: "absolute", top: -30, right: -30, width: 0, height: 0,
    borderStyle: "solid", borderLeftWidth: 140, borderBottomWidth: 140,
    borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.07)",
  },
  triTopRightInner: {
    position: "absolute", top: 10, right: 10, width: 0, height: 0,
    borderStyle: "solid", borderLeftWidth: 90, borderBottomWidth: 90,
    borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.05)",
  },
  triBottomLeft: {
    position: "absolute", bottom: 28, left: -20, width: 0, height: 0,
    borderStyle: "solid", borderRightWidth: 110, borderTopWidth: 110,
    borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)",
  },
  triMidRight: {
    position: "absolute", top: "42%", right: 30, width: 0, height: 0,
    borderStyle: "solid", borderLeftWidth: 50, borderBottomWidth: 50,
    borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.08)",
    transform: [{ rotate: "20deg" }],
  },
  triMidLeft: {
    position: "absolute", top: "30%", left: 20, width: 0, height: 0,
    borderStyle: "solid", borderRightWidth: 36, borderTopWidth: 36,
    borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.05)",
    transform: [{ rotate: "-15deg" }],
  },
  triBottomRight: {
    position: "absolute", bottom: -30, right: -30, width: 0, height: 0,
    borderStyle: "solid", borderLeftWidth: 130, borderTopWidth: 130,
    borderLeftColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)",
    transform: [{ rotate: "-5deg" }],
  },

  // ── White content card ───────────────────────────────────────────────────────
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
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: spacing.md,
  },
  scroll: { paddingBottom: spacing.xl + 16 },

  // ── Form fields ──────────────────────────────────────────────────────────────
  fieldGap: { marginTop: spacing.md },
  input: {
    fontFamily: fonts.jostRegular, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md - 2,
    borderWidth: 1.5, borderColor: colors.navInactive + "66",
  },
  inputError: { borderColor: "#EF4444" },
  textArea: { minHeight: 80, paddingTop: spacing.sm },
  hint: {
    fontFamily: fonts.jostRegular, fontSize: 11,
    color: colors.textSecondary, marginTop: 3,
  },
  charCount: {
    fontFamily: fonts.jostRegular, fontSize: 11,
    color: colors.textSecondary, textAlign: "right", marginTop: 3,
  },

  // ── Category chips ───────────────────────────────────────────────────────────
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill, borderWidth: 1.5,
    borderColor: colors.navInactive, backgroundColor: colors.surface,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catIcon: { fontSize: 15 },
  catName: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary },
  catNameActive: { color: colors.white },

  // ── Language chips ───────────────────────────────────────────────────────────
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  langChip: {
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill, borderWidth: 1.5,
    borderColor: colors.navInactive, backgroundColor: colors.surface,
  },
  langChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary },
  langTextActive: { color: colors.white },

  // ── Section headers ──────────────────────────────────────────────────────────
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.xs },
  sectionTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.textPrimary },
  sectionSub: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // ── Emergency toggle ─────────────────────────────────────────────────────────
  toggleRow: {
    marginTop: spacing.md, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radii.md,
    padding: spacing.md, borderWidth: 1.5, borderColor: colors.navInactive + "55",
  },
  toggleRowActive: { borderColor: colors.primary + "66", backgroundColor: colors.primary + "08" },
  toggleInfo: { flex: 1, gap: 2 },
  toggleTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.textPrimary },
  toggleDesc: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  togglePill: {
    width: 46, height: 26, borderRadius: radii.pill,
    backgroundColor: colors.navInactive, justifyContent: "center", paddingHorizontal: 3,
  },
  togglePillOn: { backgroundColor: colors.primary },
  toggleThumb: {
    width: 20, height: 20, borderRadius: radii.pill, backgroundColor: colors.white,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { alignSelf: "flex-end" },

  // ── Location card ─────────────────────────────────────────────────────────────
  locationCard: {
    borderRadius: radii.md, padding: spacing.md, gap: spacing.xs,
    borderWidth: 1.5, borderColor: colors.navInactive + "55",
    backgroundColor: colors.surface, alignItems: "center",
    minHeight: 72, justifyContent: "center",
  },
  locationCardGranted: {
    borderColor: colors.primary + "44",
    backgroundColor: colors.primary + "08",
  },
  locationTitle: {
    fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.textPrimary, textAlign: "center",
  },
  locationDesc: {
    fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary,
    textAlign: "center", lineHeight: 18,
  },

  // ── Error & validation ───────────────────────────────────────────────────────
  errorBanner: {
    backgroundColor: "#FEE2E2", borderRadius: radii.sm,
    padding: spacing.md, marginTop: spacing.sm,
  },
  errorText: { fontFamily: fonts.jostMedium, color: "#991B1B", fontSize: 13 },
  validationNote: {
    fontFamily: fonts.jostRegular, fontSize: 12,
    color: colors.textSecondary, textAlign: "center",
    marginTop: spacing.xs, lineHeight: 18,
  },

  // ── Submit button ────────────────────────────────────────────────────────────
  submitBtn: {
    marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radii.md,
    paddingVertical: spacing.md + 2, alignItems: "center",
    shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: {
    fontFamily: fonts.jakartaBold, color: colors.white,
    fontSize: 15, letterSpacing: 0.3,
  },
});
