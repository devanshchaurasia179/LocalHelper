import { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
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
import { router } from "expo-router";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/api";
import { useAuth } from "@/providers/AuthProvider";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { ROUTES } from "@/constants/routes";
import { colors, spacing, radii, fonts } from "@/constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { _id: string; name: string; description?: string; icon?: string };
type WorkingDay = { day: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] as const;
const WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"] as const;
const WEEKENDS = ["Saturday","Sunday"] as const;

const LANGUAGES = ["Hindi","English","Tamil","Telugu","Kannada","Bengali","Marathi","Gujarati","Punjabi"] as const;

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

// ─── Section Title (icon + text, replaces emoji headers) ───────────────────────

function SectionTitle({
  icon, title, subtitle,
}: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={sectionStyles.wrap}>
      <View style={sectionStyles.iconBadge}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={sectionStyles.textCol}>
        <Text style={sectionStyles.title}>{title}</Text>
        {subtitle ? <Text style={sectionStyles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconBadge: {
    width: 28, height: 28, borderRadius: radii.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primary + "14",
  },
  textCol: { flex: 1 },
  title: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
});

// ─── Working Days Grid ────────────────────────────────────────────────────────

const DAY_ROWS = [
  ["Monday", "Tuesday", "Wednesday", "Thursday"],
  ["Friday", "Saturday", "Sunday"],
] as const;

function WorkingDaysGrid({
  workingDays, onAdd, onRemove,
}: {
  workingDays: WorkingDay[];
  onAdd: (d: string) => void;
  onRemove: (d: string) => void;
}) {
  return (
    <View style={wdStyles.grid}>
      {DAY_ROWS.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={[wdStyles.gridRow, rowIdx === 1 && wdStyles.gridRowCentered]}
        >
          {row.map((day) => {
            const active = workingDays.some((d) => d.day === day);
            return (
              <Pressable
                key={day}
                style={[wdStyles.dayChip, active && wdStyles.dayChipActive]}
                onPress={() => active ? onRemove(day) : onAdd(day)}
                hitSlop={4}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
              >
                {active && (
                  <MaterialCommunityIcons name="check" size={13} color={colors.white} />
                )}
                <Text style={[wdStyles.dayText, active && wdStyles.dayTextActive]}>
                  {day.slice(0, 3)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const wdStyles = StyleSheet.create({
  grid: { marginTop: spacing.xs, gap: spacing.xs },
  gridRow: { flexDirection: "row", gap: spacing.xs },
  gridRowCentered: { justifyContent: "center" },
  dayChip: {
    flex: 1,
    maxWidth: "25%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.navInactive,
    backgroundColor: colors.surface,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textSecondary },
  dayTextActive: { color: colors.white },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddServiceScreen() {
  const { patchPartner } = useAuth();
  const { service, setService } = useOnboarding();

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  // Seed all fields from shared context so state is preserved when going back
  const [selectedCats, setSelectedCatsLocal] = useState<string[]>(service.selectedCats);
  const [experience, setExperienceLocal] = useState(service.experience);
  const [selectedLangs, setSelectedLangsLocal] = useState<string[]>(service.selectedLangs);
  const [bio, setBioLocal] = useState(service.bio);
  const [visitingCreditsType, setVisitingCreditsTypeLocal] = useState<"perVisit" | "perHour" | "perDay" | "perWeek">(service.visitingCreditsType);
  const [visitingCreditsAmount, setVisitingCreditsAmountLocal] = useState(service.visitingCreditsAmount);
  const [workingDays, setWorkingDaysLocal] = useState<WorkingDay[]>(service.workingDays);

  // Sync to context whenever local state changes
  useEffect(() => {
    setService({
      selectedCats,
      experience,
      selectedLangs,
      bio,
      visitingCreditsType,
      visitingCreditsAmount,
      workingDays,
    });
  }, [selectedCats, experience, selectedLangs, bio, visitingCreditsType, visitingCreditsAmount, workingDays, setService]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  useEffect(() => {
    api.get<{ categories: Category[] }>("/categories")
      .then((res) => setCategories(res.data.categories ?? []))
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false));
  }, []);

  // ── Prefill from server when context is cold (back-navigation or deep link)
  useEffect(() => {
    // Skip if context already has data typed by the user this session
    if (service.selectedCats.length > 0) return;

    api.get<{
      service: {
        categories: { _id: string }[];
        experience?: number;
        languages: string[];
        bio?: string;
        visitingCredits: { type: "perVisit" | "perHour" | "perDay" | "perWeek"; amount: number };
        emergencyAvailable: boolean;
        workingDays: WorkingDay[];
      };
    }>("/partner/service")
      .then(({ data }) => {
        const s = data.service;
        if (!s) return;

        const cats  = (s.categories ?? []).map((c) => c._id);
        const expStr = s.experience != null ? String(s.experience) : "";
        const langs  = s.languages ?? [];
        const bioVal = s.bio ?? "";
        const vcType = s.visitingCredits?.type ?? "perVisit";
        const vcAmt  = s.visitingCredits?.amount != null ? String(s.visitingCredits.amount) : "";
        const wdays  = s.workingDays ?? [];

        // Only prefill if the server actually has saved data
        if (cats.length === 0) return;

        // Sync context
        setService({
          selectedCats:    cats,
          experience:      expStr,
          selectedLangs:   langs,
          bio:             bioVal,
          visitingCreditsType: vcType,
          visitingCreditsAmount: vcAmt,
          workingDays:     wdays,
        });

        // Sync local state so the currently-rendered fields update immediately
        setSelectedCatsLocal(cats);
        setExperienceLocal(expStr);
        setSelectedLangsLocal(langs);
        setBioLocal(bioVal);
        setVisitingCreditsTypeLocal(vcType);
        setVisitingCreditsAmountLocal(vcAmt);
        setWorkingDaysLocal(wdays);
      })
      .catch(() => {
        // silently ignore — partner can fill manually
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCat = (id: string) =>
    setSelectedCatsLocal((p) => p.includes(id) ? p.filter((c) => c !== id) : [...p, id]);

  const toggleLang = (lang: string) =>
    setSelectedLangsLocal((p) => p.includes(lang) ? p.filter((l) => l !== lang) : [...p, lang]);

  const addDay = (day: string) =>
    setWorkingDaysLocal((p) => [...p, { day }]);

  const removeDay = (day: string) =>
    setWorkingDaysLocal((p) => p.filter((d) => d.day !== day));

  const applyPreset = (days: readonly string[]) =>
    setWorkingDaysLocal((prev) =>
      days.map((day) => prev.find((d) => d.day === day) ?? { day })
    );

  const clearDays = () => setWorkingDaysLocal([]);

  const isValid =
    selectedCats.length > 0 &&
    visitingCreditsAmount.trim().length > 0 &&
    !isNaN(Number(visitingCreditsAmount)) &&
    Number(visitingCreditsAmount) >= 0;

  const handleSubmit = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await api.put("/partner/service/setup", {
        categories: selectedCats,
        experience: experience ? Number(experience) : undefined,
        languages: selectedLangs,
        bio: bio.trim() || undefined,
        visitingCreditsType: visitingCreditsType,
        visitingCreditsAmount: Number(visitingCreditsAmount),
        workingDays: workingDays.length > 0 ? workingDays : undefined,
      });
      patchPartner({ isService: true });
      router.push(ROUTES.ONBOARDING.DOCUMENTS as any);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedCats, experience, selectedLangs, bio, visitingCreditsType, visitingCreditsAmount, workingDays, patchPartner]);

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
          {/* Back button */}
          <Pressable
            style={styles.heroBackBtn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace(ROUTES.ONBOARDING.PROFILE as any);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
          </Pressable>
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
                      <MaterialCommunityIcons
                        name={(cat.icon as any) || "tools"}
                        size={16}
                        color={active ? colors.white : colors.textSecondary}
                      />
                      <Text style={[styles.catName, active && styles.catNameActive]}>{cat.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

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
                onChangeText={(t) => setExperienceLocal(t.replace(/\D/g, ""))}
                accessibilityLabel="Years of experience"
              />
            </View>

            {/* ── Languages ──────────────────────────────────────────── */}
            <View style={styles.fieldGap}>
              <FieldLabel label="Languages spoken" />
              
              {/* Dropdown trigger */}
              <Pressable
                style={styles.dropdownBtn}
                onPress={() => setShowLangDropdown(!showLangDropdown)}
              >
                <MaterialCommunityIcons name="translate" size={16} color={colors.primary} />
                <Text style={styles.dropdownBtnText}>
                  {selectedLangs.length > 0 ? `${selectedLangs.length} selected` : "Select languages"}
                </Text>
                <MaterialCommunityIcons
                  name={showLangDropdown ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>

              {/* Dropdown menu */}
              {showLangDropdown && (
                <View style={styles.dropdownMenuWrapper}>
                  <ScrollView style={styles.dropdownMenu} nestedScrollEnabled scrollEnabled showsVerticalScrollIndicator>
                    {LANGUAGES.map((lang) => {
                      const isSelected = selectedLangs.includes(lang);
                      return (
                        <Pressable
                          key={lang}
                          style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                          onPress={() => toggleLang(lang)}
                        >
                          <View style={[styles.dropdownCheckbox, isSelected && styles.dropdownCheckboxActive]}>
                            {isSelected && <MaterialCommunityIcons name="check" size={14} color={colors.white} />}
                          </View>
                          <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                            {lang}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Selected languages chips */}
              {selectedLangs.length > 0 && (
                <View style={styles.selectedLangsWrap}>
                  {selectedLangs.map((lang) => (
                    <View key={lang} style={styles.selectedLangChip}>
                      <Text style={styles.selectedLangText}>{lang}</Text>
                      <Pressable
                        onPress={() => setSelectedLangsLocal((p) => p.filter((l) => l !== lang))}
                        hitSlop={6}
                      >
                        <MaterialCommunityIcons name="close" size={14} color={colors.white} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              
              <Text style={styles.hint}>Add or remove languages to communicate with customers</Text>
            </View>

            {/* ── Bio ────────────────────────────────────────────────── */}
            <View style={styles.fieldGap}>
              <FieldLabel label="Short bio" />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell customers a bit about yourself and your work…"
                placeholderTextColor={colors.textSecondary}
                value={bio}
                onChangeText={setBioLocal}
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
              <SectionTitle icon="currency-inr" title="Pricing & Availability" />
            </View>

            <View style={styles.fieldGap}>
              <FieldLabel label="Pricing model" required />
              <View style={styles.pricingTypeGrid}>
                {(['perVisit', 'perHour', 'perDay', 'perWeek'] as const).map((type) => {
                  const isSelected = visitingCreditsType === type;
                  const typeLabels = {
                    perVisit: 'Per Visit',
                    perHour: 'Per Hour',
                    perDay: 'Per Day',
                    perWeek: 'Per Week',
                  };
                  return (
                    <Pressable
                      key={type}
                      style={[styles.pricingTypeChip, isSelected && styles.pricingTypeChipActive]}
                      onPress={() => { setError(null); setVisitingCreditsTypeLocal(type); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={16} color={colors.white} />
                      )}
                      <Text style={[styles.pricingTypeText, isSelected && styles.pricingTypeTextActive]}>
                        {typeLabels[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGap}>
              <FieldLabel label="Fees (₹)" required />
              <TextInput
                style={[styles.input, visitingCreditsAmount.length > 0 && isNaN(Number(visitingCreditsAmount)) && styles.inputError]}
                placeholder="e.g. 150"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={visitingCreditsAmount}
                onChangeText={(t) => { setError(null); setVisitingCreditsAmountLocal(t.replace(/\D/g, "")); }}
                accessibilityLabel="Pricing amount in rupees"
              />
              <Text style={styles.hint}>
                {visitingCreditsType === 'perVisit' && 'Amount charged per visit to the customer'}
                {visitingCreditsType === 'perHour' && 'Amount charged per hour of service'}
                {visitingCreditsType === 'perDay' && 'Amount charged per day'}
                {visitingCreditsType === 'perWeek' && 'Amount charged per week'}
              </Text>
            </View>

            {/* ── Working days ───────────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <SectionTitle
                icon="calendar-clock-outline"
                title="Working Schedule"
                subtitle="Select the days you're available"
              />
            </View>

            <View style={styles.presetRow}>
              <Pressable style={styles.presetChip} onPress={() => applyPreset(WEEKDAYS)}>
                <Text style={styles.presetChipText}>Weekdays</Text>
              </Pressable>
              <Pressable style={styles.presetChip} onPress={() => applyPreset(WEEKENDS)}>
                <Text style={styles.presetChipText}>Weekends</Text>
              </Pressable>
              <Pressable style={styles.presetChip} onPress={() => applyPreset(ALL_DAYS)}>
                <Text style={styles.presetChipText}>All days</Text>
              </Pressable>
              {workingDays.length > 0 && (
                <Pressable style={styles.presetChipClear} onPress={clearDays}>
                  <MaterialCommunityIcons name="close" size={13} color={colors.textSecondary} />
                  <Text style={styles.presetChipText}>Clear</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.fieldGap}>
              <WorkingDaysGrid
                workingDays={workingDays}
                onAdd={addDay}
                onRemove={removeDay}
              />
            </View>

            {/* ── Error banner ───────────────────────────────────────── */}
            {error ? (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#991B1B" />
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
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <View style={styles.submitBtnContent}>
                  <Text style={styles.submitBtnText}>Save & Continue</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.white} />
                </View>
              )}
            </Pressable>

            {!isValid && (
              <Text style={styles.validationNote}>
                Fill in categories and pricing to continue.
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
  heroBackBtn: {
    position: "absolute",
    top: 56,
    left: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
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
  catName: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary },
  catNameActive: { color: colors.white },

  // ── Language chips ───────────────────────────────────────────────────────────
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "66",
    marginTop: spacing.xs,
  },
  dropdownBtnText: {
    flex: 1,
    fontFamily: fonts.jostMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  dropdownMenu: {
    maxHeight: 280,
  },
  dropdownMenuWrapper: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "66",
    overflow: "hidden",
    maxHeight: 280,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.navInactive + "33",
  },
  dropdownItemActive: {
    backgroundColor: colors.primary + "12",
  },
  dropdownCheckbox: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.navInactive,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  dropdownCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dropdownItemText: {
    flex: 1,
    fontFamily: fonts.jostMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  selectedLangsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  selectedLangChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs - 1,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  selectedLangText: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: colors.white,
  },

  // ── Section headers ──────────────────────────────────────────────────────────
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.xs },

  // ── Working schedule presets ─────────────────────────────────────────────────
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs, marginBottom: spacing.xs },
  presetChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill,
    borderWidth: 1.5, borderColor: colors.primary + "44", backgroundColor: colors.primary + "0D",
  },
  presetChipClear: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill,
    borderWidth: 1.5, borderColor: colors.navInactive, backgroundColor: colors.surface,
  },
  presetChipText: { fontFamily: fonts.jostMedium, fontSize: 11, color: colors.textPrimary },

  // ── Pricing type selector ────────────────────────────────────────────────────
  pricingTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  pricingTypeChip: {
    flex: 1, minWidth: 80, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs,
    paddingVertical: spacing.sm + 2, borderRadius: radii.md, borderWidth: 1.5,
    borderColor: colors.navInactive, backgroundColor: colors.surface,
  },
  pricingTypeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pricingTypeText: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary },
  pricingTypeTextActive: { color: colors.white },

  // ── Error & validation ───────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.xs,
    backgroundColor: "#FEE2E2", borderRadius: radii.sm,
    padding: spacing.md, marginTop: spacing.sm,
  },
  errorText: { fontFamily: fonts.jostMedium, color: "#991B1B", fontSize: 13, flex: 1 },
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
  submitBtnContent: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  submitBtnText: {
    fontFamily: fonts.jakartaBold, color: colors.white,
    fontSize: 15, letterSpacing: 0.3,
  },
});