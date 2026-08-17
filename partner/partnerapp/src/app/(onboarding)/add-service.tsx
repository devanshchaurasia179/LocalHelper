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
import type { SelectedSubcategory } from "@/contexts/OnboardingContext";
import { ROUTES } from "@/constants/routes";
import { colors, spacing, radii, fonts } from "@/constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type Subcategory = { _id: string; name: string; icon?: string };
type Category = {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  subcategories: Subcategory[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = ["Hindi","English","Punjabi","Tamil","Telugu","Kannada","Bengali","Marathi","Gujarati"] as const;

// ─── FieldLabel ───────────────────────────────────────────────────────────────

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

// ─── SectionTitle ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, title, subtitle }: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={secStyles.wrap}>
      <View style={secStyles.iconBadge}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={secStyles.textCol}>
        <Text style={secStyles.title}>{title}</Text>
        {subtitle ? <Text style={secStyles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
const secStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconBadge: {
    width: 28, height: 28, borderRadius: radii.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primary + "14",
  },
  textCol: { flex: 1 },
  title: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
});

// ─── NestedCategoryPicker ─────────────────────────────────────────────────────
// Single-select: picking one subcategory replaces any previous selection and
// closes the dropdown immediately. The trigger shows the selected service name.

function NestedCategoryPicker({
  categories,
  selectedSubcats,
  onSelect,
}: {
  categories: Category[];
  selectedSubcats: SelectedSubcategory[];
  onSelect: (catId: string, subId: string) => void;
}) {
  const [outerOpen, setOuterOpen] = useState(false);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  const selected = selectedSubcats[0] ?? null;
  const selectedLabel = (() => {
    if (!selected) return null;
    const cat = categories.find((c) => c._id === selected.categoryId);
    const sub = cat?.subcategories.find((s) => s._id === selected.subcategoryId);
    if (!sub) return null;
    return { catName: cat!.name, subName: sub.name };
  })();

  const isSelected = (catId: string, subId: string) =>
    selected?.categoryId === catId && selected?.subcategoryId === subId;

  const handleSubPress = (catId: string, subId: string) => {
    onSelect(catId, subId);
    setOuterOpen(false);
    setActiveCatId(null);
  };

  return (
    <View style={nd.root}>
      {/* ── Trigger ── */}
      <Pressable
        style={[nd.trigger, outerOpen && nd.triggerOpen]}
        onPress={() => { setOuterOpen((v) => !v); if (outerOpen) setActiveCatId(null); }}
        accessibilityRole="button"
        accessibilityLabel="Select service"
      >
        <View style={[nd.triggerIconWrap, outerOpen && nd.triggerIconWrapOpen]}>
          <MaterialCommunityIcons
            name="shape-outline"
            size={16}
            color={outerOpen ? colors.primary : colors.textSecondary}
          />
        </View>
        <View style={nd.triggerContent}>
          {selectedLabel ? (
            <View style={nd.selectedPill}>
              <Text style={nd.selectedPillSub} numberOfLines={1}>{selectedLabel.subName}</Text>
              <Text style={nd.selectedPillCat} numberOfLines={1}> · {selectedLabel.catName}</Text>
            </View>
          ) : (
            <Text style={nd.triggerPlaceholder}>Tap to pick your service</Text>
          )}
        </View>
        <View style={[nd.chevronWrap, outerOpen && nd.chevronWrapOpen]}>
          <MaterialCommunityIcons
            name={outerOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color={outerOpen ? colors.primary : colors.textSecondary}
          />
        </View>
      </Pressable>

      {/* ── Panel ── */}
      {outerOpen && (
        <View style={nd.panel}>
          {categories.map((cat, catIdx) => {
            const isCatActive = activeCatId === cat._id;
            const isLast = catIdx === categories.length - 1;
            return (
              <View key={cat._id}>
                {/* Category row */}
                <Pressable
                  style={[nd.catRow, isCatActive && nd.catRowActive, isLast && !isCatActive && nd.catRowLast]}
                  onPress={() => setActiveCatId(isCatActive ? null : cat._id)}
                  accessibilityRole="button"
                >
                  <View style={[nd.catAccent, isCatActive && nd.catAccentActive]} />
                  <View style={[nd.catIconBadge, isCatActive && nd.catIconBadgeActive]}>
                    <MaterialCommunityIcons
                      name={(cat.icon as any) || "briefcase-outline"}
                      size={15}
                      color={isCatActive ? colors.primary : colors.textSecondary}
                    />
                  </View>
                  <Text style={[nd.catRowText, isCatActive && nd.catRowTextActive]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                  <View style={[nd.catBadge, isCatActive && nd.catBadgeActive]}>
                    <Text style={[nd.catBadgeText, isCatActive && nd.catBadgeTextActive]}>
                      {cat.subcategories.length}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isCatActive ? "chevron-up" : "chevron-right"}
                    size={15}
                    color={isCatActive ? colors.primary : colors.textSecondary + "99"}
                  />
                </Pressable>

                {/* ── Subcategory chip grid ── */}
                {isCatActive && (
                  <View style={nd.subGrid}>
                    {cat.subcategories.map((sub) => {
                      const active = isSelected(cat._id, sub._id);
                      return (
                        <Pressable
                          key={sub._id}
                          style={[nd.subChip, active && nd.subChipActive]}
                          onPress={() => handleSubPress(cat._id, sub._id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                        >
                          {active && (
                            <MaterialCommunityIcons name="check-circle" size={13} color={colors.primary} />
                          )}
                          <Text style={[nd.subChipText, active && nd.subChipTextActive]} numberOfLines={1}>
                            {sub.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const nd = StyleSheet.create({
  root: { marginTop: spacing.xs },

  // Trigger
  trigger: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm + 2,
    borderRadius: radii.md, borderWidth: 1.5,
    borderColor: colors.navInactive + "55",
    backgroundColor: colors.white,
    minHeight: 52,
  },
  triggerOpen: {
    borderColor: colors.primary,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    backgroundColor: colors.primary + "05",
  },
  triggerIconWrap: {
    width: 34, height: 34, borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  triggerIconWrapOpen: { backgroundColor: colors.primary + "15" },
  triggerContent: { flex: 1 },
  selectedPill: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  selectedPillSub: { fontFamily: fonts.jostMedium, fontSize: 14, color: colors.textPrimary },
  selectedPillCat: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary },
  triggerPlaceholder: { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary },
  chevronWrap: {
    width: 28, height: 28, borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  chevronWrapOpen: { backgroundColor: colors.primary + "15" },

  // Panel
  panel: {
    borderWidth: 1.5, borderTopWidth: 0, borderColor: colors.primary,
    borderBottomLeftRadius: radii.md, borderBottomRightRadius: radii.md,
    backgroundColor: colors.white, overflow: "hidden",
  },

  // Category rows
  catRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingRight: spacing.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.navInactive + "22",
    backgroundColor: colors.white,
  },
  catRowActive: { backgroundColor: colors.primary + "06" },
  catRowLast: { borderBottomWidth: 0 },
  catAccent: { width: 3, height: "100%", borderRadius: 2, backgroundColor: "transparent" },
  catAccentActive: { backgroundColor: colors.primary },
  catIconBadge: {
    width: 32, height: 32, borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  catIconBadgeActive: { backgroundColor: colors.primary + "15" },
  catRowText: { flex: 1, fontFamily: fonts.jostMedium, fontSize: 14, color: colors.textPrimary },
  catRowTextActive: { color: colors.primary },
  catBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  catBadgeActive: { backgroundColor: colors.primary + "18" },
  catBadgeText: { fontFamily: fonts.jostMedium, fontSize: 11, color: colors.textSecondary },
  catBadgeTextActive: { color: colors.primary },

  // Subcategory chip grid
  subGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.md + 35,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.navInactive + "22",
  },
  subChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill, borderWidth: 1.5,
    borderColor: colors.navInactive + "55",
    backgroundColor: colors.white,
  },
  subChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "0D",
  },
  subChipText: { fontFamily: fonts.jostRegular, fontSize: 12.5, color: colors.textPrimary },
  subChipTextActive: { fontFamily: fonts.jostMedium, color: colors.primary },
});

// ─── PricingTypeSelector ─────────────────────────────────────────────────────
// Segmented pill selector — no dropdown, all options visible at once.

const PRICING_OPTIONS = [
  { value: "perVisit" as const, label: "Per Visit",  icon: "walk" as const },
  { value: "perHour" as const,  label: "Per Hour",   icon: "clock-outline" as const },
  { value: "perDay" as const,   label: "Per Day",    icon: "weather-sunny" as const },
  { value: "perWeek" as const,  label: "Per Week",   icon: "calendar-week" as const },
];

function PricingTypeSelector({
  value,
  onChange,
}: {
  value: "perVisit" | "perHour" | "perDay" | "perWeek";
  onChange: (v: "perVisit" | "perHour" | "perDay" | "perWeek") => void;
}) {
  return (
    <View style={ps.wrap}>
      {PRICING_OPTIONS.map((opt, idx) => {
        const isActive = opt.value === value;
        const isFirst = idx === 0;
        const isLast = idx === PRICING_OPTIONS.length - 1;
        return (
          <Pressable
            key={opt.value}
            style={[
              ps.seg,
              isActive && ps.segActive,
              isFirst && ps.segFirst,
              isLast && ps.segLast,
              !isLast && ps.segBorder,
            ]}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
          >
            <MaterialCommunityIcons
              name={opt.icon}
              size={14}
              color={isActive ? colors.primary : colors.textSecondary}
            />
            <Text style={[ps.segText, isActive && ps.segTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ps = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: radii.sm, borderWidth: 1.5,
    borderColor: colors.navInactive + "55",
    overflow: "hidden",
    backgroundColor: colors.surface,
    height: 48,
  },
  seg: {
    flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 2, backgroundColor: colors.surface,
  },
  segActive: { backgroundColor: colors.primary + "12" },
  segFirst: { borderTopLeftRadius: radii.sm - 2, borderBottomLeftRadius: radii.sm - 2 },
  segLast: { borderTopRightRadius: radii.sm - 2, borderBottomRightRadius: radii.sm - 2 },
  segBorder: { borderRightWidth: 1.5, borderRightColor: colors.navInactive + "44" },
  segText: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary },
  segTextActive: { fontFamily: fonts.jostMedium, color: colors.primary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddServiceScreen() {
  const { patchPartner } = useAuth();
  const { service, setService } = useOnboarding();

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  // Local state seeded from shared context
  const [selectedSubcats, setSelectedSubcatsLocal] = useState<SelectedSubcategory[]>(
    service.selectedSubcats ?? []
  );
  const [experience, setExperienceLocal] = useState(service.experience);
  const [selectedLangs, setSelectedLangsLocal] = useState<string[]>(service.selectedLangs);
  const [bio, setBioLocal] = useState(service.bio);
  const [visitingCreditsType, setVisitingCreditsTypeLocal] = useState<
    "perVisit" | "perHour" | "perDay" | "perWeek"
  >(service.visitingCreditsType);
  const [visitingCreditsAmount, setVisitingCreditsAmountLocal] = useState(
    service.visitingCreditsAmount
  );

  // Derive selected category IDs from subcats (unique parent IDs)
  const selectedCats = [...new Set(selectedSubcats.map((s) => s.categoryId))];

  // Sync to context on change
  useEffect(() => {
    setService({
      selectedCats,
      selectedSubcats,
      experience,
      selectedLangs,
      bio,
      visitingCreditsType,
      visitingCreditsAmount,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubcats, experience, selectedLangs, bio, visitingCreditsType, visitingCreditsAmount]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  // Fetch categories with subcategories from backend
  useEffect(() => {
    api.get<{ categories: Category[] }>("/categories")
      .then((res) => setCategories(res.data.categories ?? []))
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false));
  }, []);

  // Prefill from server when context is cold
  useEffect(() => {
    if ((service.selectedSubcats ?? []).length > 0) return;

    api.get<{
      service: {
        categories: { _id: string }[];
        subcategories: { categoryId: string; subcategoryId: string }[];
        experience?: number;
        languages: string[];
        bio?: string;
        visitingCredits: { type: "perVisit" | "perHour" | "perDay" | "perWeek"; amount: number };
      };
    }>("/partner/service")
      .then(({ data }) => {
        const s = data.service;
        if (!s) return;
        const subs = (s.subcategories ?? []).filter(
          (x) => x.categoryId && x.subcategoryId
        );
        if (subs.length === 0) return;

        const expStr = s.experience != null ? String(s.experience) : "";
        const langs = s.languages ?? [];
        const bioVal = s.bio ?? "";
        const vcType = s.visitingCredits?.type ?? "perVisit";
        const vcAmt = s.visitingCredits?.amount != null ? String(s.visitingCredits.amount) : "";

        setService({
          selectedCats: [...new Set(subs.map((x) => x.categoryId))],
          selectedSubcats: subs,
          experience: expStr,
          selectedLangs: langs,
          bio: bioVal,
          visitingCreditsType: vcType,
          visitingCreditsAmount: vcAmt,
        });
        setSelectedSubcatsLocal(subs);
        setExperienceLocal(expStr);
        setSelectedLangsLocal(langs);
        setBioLocal(bioVal);
        setVisitingCreditsTypeLocal(vcType);
        setVisitingCreditsAmountLocal(vcAmt);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const selectSubcat = (catId: string, subId: string) => {
    setError(null);
    // Single-select: replace any previous selection entirely
    setSelectedSubcatsLocal([{ categoryId: catId, subcategoryId: subId }]);
  };

  const toggleLang = (lang: string) =>
    setSelectedLangsLocal((p) => p.includes(lang) ? p.filter((l) => l !== lang) : [...p, lang]);

  const isValid =
    selectedSubcats.length > 0 &&
    visitingCreditsAmount.trim().length > 0 &&
    !isNaN(Number(visitingCreditsAmount)) &&
    Number(visitingCreditsAmount) >= 0;

  const handleSubmit = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await api.put("/partner/service/setup", {
        categories: selectedCats,
        subcategories: selectedSubcats,
        experience: experience ? Number(experience) : undefined,
        languages: selectedLangs,
        bio: bio.trim() || undefined,
        visitingCreditsType,
        visitingCreditsAmount: Number(visitingCreditsAmount),
      });
      patchPartner({ isService: true });
      router.push(ROUTES.ONBOARDING.DOCUMENTS as any);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubcats, selectedCats, experience, selectedLangs, bio, visitingCreditsType, visitingCreditsAmount, patchPartner]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>

        {/* ── Hero band ── */}
        <View style={styles.hero}>
          <View style={styles.triTopRight} pointerEvents="none" />
          <View style={styles.triTopRightInner} pointerEvents="none" />
          <View style={styles.triBottomLeft} pointerEvents="none" />
          <View style={styles.triMidRight} pointerEvents="none" />
          <View style={styles.triMidLeft} pointerEvents="none" />
          <View style={styles.triBottomRight} pointerEvents="none" />
          <Pressable
            style={styles.heroBackBtn}
            onPress={() => router.canGoBack() ? router.back() : router.replace(ROUTES.ONBOARDING.PROFILE as any)}
            accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
          </Pressable>
          <Text style={styles.appName}>LocalHelpers Partner</Text>
          <Text style={styles.heroTitle}>Set up your{"\n"}service</Text>
          <Text style={styles.heroSub}>Step 2 of 3 — What do you offer?</Text>
        </View>

        {/* ── White card ── */}
        <View style={styles.card}>
          <View style={styles.handle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {/* ── Service Categories + Subcategories ── */}
            <View style={styles.sectionHeader}>
              <SectionTitle
                icon="shape-outline"
                title="Service Categories"
                subtitle="Select the category, then pick your specialisation"
              />
            </View>
            <FieldLabel label="Your service" required />

            {catLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
            ) : categories.length === 0 ? (
              <Text style={styles.hint}>No categories available. Please try again later.</Text>
            ) : (
              <NestedCategoryPicker
                categories={categories}
                selectedSubcats={selectedSubcats}
                onSelect={selectSubcat}
              />
            )}

            {/* ── Experience ── */}
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

            {/* ── Languages ── */}
            <View style={styles.fieldGap}>
              <FieldLabel label="Languages spoken" />
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
                  size={18} color={colors.textSecondary}
                />
              </Pressable>
              {showLangDropdown && (
                <View style={styles.dropdownMenuWrapper}>
                  <ScrollView style={styles.dropdownMenu} nestedScrollEnabled showsVerticalScrollIndicator>
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
              {selectedLangs.length > 0 && (
                <View style={styles.selectedLangsWrap}>
                  {selectedLangs.map((lang) => (
                    <View key={lang} style={styles.selectedLangChip}>
                      <Text style={styles.selectedLangText}>{lang}</Text>
                      <Pressable onPress={() => setSelectedLangsLocal((p) => p.filter((l) => l !== lang))} hitSlop={6}>
                        <MaterialCommunityIcons name="close" size={14} color={colors.white} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.hint}>Tap languages to select or deselect</Text>
            </View>

            {/* ── Bio ── */}
            <View style={styles.fieldGap}>
              <FieldLabel label="Short bio" />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell customers a bit about yourself and your work…"
                placeholderTextColor={colors.textSecondary}
                value={bio}
                onChangeText={setBioLocal}
                multiline numberOfLines={3} maxLength={300}
                textAlignVertical="top"
                accessibilityLabel="Short bio"
              />
              <Text style={styles.charCount}>{bio.length}/300</Text>
            </View>

            {/* ── Pricing ── */}
            <View style={styles.sectionHeader}>
              <SectionTitle icon="currency-inr" title="Pricing & Availability" />
            </View>
            <View style={styles.fieldGap}>
              <FieldLabel label="Fees (₹)" required />
              <TextInput
                style={[styles.input, styles.feesInput, visitingCreditsAmount.length > 0 && isNaN(Number(visitingCreditsAmount)) && styles.inputError]}
                placeholder="e.g. 150"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={visitingCreditsAmount}
                onChangeText={(t) => { setError(null); setVisitingCreditsAmountLocal(t.replace(/\D/g, "")); }}
                accessibilityLabel="Pricing amount in rupees"
              />
            </View>
            <View style={styles.fieldGap}>
              <FieldLabel label="Billing model" required />
              <PricingTypeSelector
                value={visitingCreditsType}
                onChange={(t) => { setError(null); setVisitingCreditsTypeLocal(t); }}
              />
            </View>
            <Text style={styles.hint}>
              {visitingCreditsType === "perVisit" && "Amount charged per visit to the customer"}
              {visitingCreditsType === "perHour" && "Amount charged per hour of service"}
              {visitingCreditsType === "perDay" && "Amount charged per day"}
              {visitingCreditsType === "perWeek" && "Amount charged per week"}
            </Text>

            {/* ── Error banner ── */}
            {error ? (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#991B1B" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* ── Submit ── */}
            <Pressable
              style={[styles.submitBtn, (!isValid || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || loading}
              accessibilityRole="button" accessibilityLabel="Save service details"
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
                Select at least one service and fill in pricing to continue.
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
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },

  // Hero
  hero: {
    flex: 1, backgroundColor: colors.primary, paddingTop: 64,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xl + 16,
    overflow: "hidden", justifyContent: "flex-end",
  },
  heroBackBtn: {
    position: "absolute", top: 56, left: spacing.lg, width: 36, height: 36,
    borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", zIndex: 10,
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

  // Triangles
  triTopRight: {
    position: "absolute", top: -30, right: -30, width: 0, height: 0, borderStyle: "solid",
    borderLeftWidth: 140, borderBottomWidth: 140, borderLeftColor: "transparent",
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  triTopRightInner: {
    position: "absolute", top: 10, right: 10, width: 0, height: 0, borderStyle: "solid",
    borderLeftWidth: 90, borderBottomWidth: 90, borderLeftColor: "transparent",
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  triBottomLeft: {
    position: "absolute", bottom: 28, left: -20, width: 0, height: 0, borderStyle: "solid",
    borderRightWidth: 110, borderTopWidth: 110, borderRightColor: "transparent",
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  triMidRight: {
    position: "absolute", top: "42%", right: 30, width: 0, height: 0, borderStyle: "solid",
    borderLeftWidth: 50, borderBottomWidth: 50, borderLeftColor: "transparent",
    borderBottomColor: "rgba(255,255,255,0.08)", transform: [{ rotate: "20deg" }],
  },
  triMidLeft: {
    position: "absolute", top: "30%", left: 20, width: 0, height: 0, borderStyle: "solid",
    borderRightWidth: 36, borderTopWidth: 36, borderRightColor: "transparent",
    borderTopColor: "rgba(255,255,255,0.05)", transform: [{ rotate: "-15deg" }],
  },
  triBottomRight: {
    position: "absolute", bottom: -30, right: -30, width: 0, height: 0, borderStyle: "solid",
    borderLeftWidth: 130, borderTopWidth: 130, borderLeftColor: "transparent",
    borderTopColor: "rgba(255,255,255,0.06)", transform: [{ rotate: "-5deg" }],
  },

  // Card
  card: {
    backgroundColor: colors.white, borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8, paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm, marginTop: -28, flex: 2,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.45, shadowRadius: 18, elevation: 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: spacing.md,
  },
  scroll: { paddingBottom: spacing.xl + 16 },

  // Section header
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.sm },

  // Form
  fieldGap: { marginTop: spacing.md },
  input: {
    fontFamily: fonts.jostRegular, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md - 2,
    borderWidth: 1.5, borderColor: colors.navInactive + "66",
  },
  inputError: { borderColor: "#EF4444" },
  textArea: { minHeight: 80, paddingTop: spacing.sm },
  hint: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, marginTop: 3 },
  charCount: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, textAlign: "right", marginTop: 3 },

  // Language dropdown
  dropdownBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderWidth: 1.5, borderColor: colors.navInactive + "55",
    minHeight: 52,
  },
  dropdownBtnText: { flex: 1, fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textPrimary },
  dropdownMenuWrapper: {
    marginTop: spacing.xs, borderRadius: radii.md, overflow: "hidden",
    borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  dropdownMenu: { maxHeight: 220, backgroundColor: colors.white },
  dropdownItem: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 3,
    borderBottomWidth: 1, borderBottomColor: colors.navInactive + "22",
  },
  dropdownItemActive: { backgroundColor: colors.primary + "08" },
  dropdownCheckbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 1.5,
    borderColor: colors.navInactive + "77", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface,
  },
  dropdownCheckboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dropdownItemText: { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textPrimary },
  dropdownItemTextActive: { fontFamily: fonts.jostMedium, color: colors.primary },
  selectedLangsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  selectedLangChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 5,
    borderRadius: radii.pill, backgroundColor: colors.primary,
  },
  selectedLangText: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.white },

  // Fees input
  feesInput: { height: 48, borderRadius: radii.sm },

  // Error / submit
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "#FEF2F2", borderRadius: radii.sm, padding: spacing.sm + 2,
    marginTop: spacing.md, borderWidth: 1, borderColor: "#FECACA",
  },
  errorText: { flex: 1, fontFamily: fonts.jostRegular, fontSize: 13, color: "#991B1B" },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md,
    paddingVertical: spacing.md, marginTop: spacing.lg, alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnContent: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  submitBtnText: { fontFamily: fonts.jakartaSemiBold, fontSize: 16, color: colors.white },
  validationNote: {
    fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary,
    textAlign: "center", marginTop: spacing.sm,
  },
});
