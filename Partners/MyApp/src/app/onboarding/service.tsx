import { useEffect, useState } from 'react';
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

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getCategories } from '@/constants/category.api';
import { setupService } from '@/constants/service.api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { _id: string; name: string };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type WorkingDay = { day: string; startTime: string; endTime: string };

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * Onboarding Step 2 – Service Setup
 * Fields: categories, skills, experience, languages, bio,
 *         minimumCharge, hourlyRate, emergencyAvailable,
 *         serviceRadius, workingDays
 * Calls PUT /api/partner/service/setup
 * On success → navigate to /onboarding/documents
 */
export default function OnboardingServiceScreen() {
  const router = useRouter();
  const { patchPartner } = useAuth();
  const colors = useTheme();

  // ── Categories ──────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // ── Skills ──────────────────────────────────────────────────────────────
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  // ── Languages ───────────────────────────────────────────────────────────
  const [languageInput, setLanguageInput] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);

  // ── Other fields ────────────────────────────────────────────────────────
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [visitingCredits, setVisitingCredits] = useState('');
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [serviceRadius, setServiceRadius] = useState('10');

  // ── Working days ────────────────────────────────────────────────────────
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);

  // ── Form state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Load categories on mount ─────────────────────────────────────────────
  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.data.categories ?? res.data))
      .catch(() => setError('Failed to load categories. Please restart.'))
      .finally(() => setLoadingCategories(false));
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isValid =
    selectedCategories.length > 0 &&
    skills.length > 0 &&
    visitingCredits.trim() !== '';

  const validationHints = [
    selectedCategories.length === 0 && 'Select at least one service category',
    skills.length === 0 && 'Add at least one skill',
    visitingCredits.trim() === '' && 'Enter your visiting credits (visit charge)',
  ].filter(Boolean) as string[];

  // ── Skill helpers ────────────────────────────────────────────────────────
  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) {
      setSkills((prev) => [...prev, s]);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) =>
    setSkills((prev) => prev.filter((s) => s !== skill));

  // ── Language helpers ─────────────────────────────────────────────────────
  const addLanguage = () => {
    const l = languageInput.trim();
    if (l && !languages.includes(l)) {
      setLanguages((prev) => [...prev, l]);
    }
    setLanguageInput('');
  };

  const removeLanguage = (lang: string) =>
    setLanguages((prev) => prev.filter((l) => l !== lang));

  // ── Working day helpers ───────────────────────────────────────────────────
  const toggleDay = (day: string) => {
    const exists = workingDays.find((d) => d.day === day);
    if (exists) {
      setWorkingDays((prev) => prev.filter((d) => d.day !== day));
    } else {
      setWorkingDays((prev) => [...prev, { day, startTime: '09:00', endTime: '18:00' }]);
    }
  };

  const updateDayTime = (
    day: string,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setWorkingDays((prev) =>
      prev.map((d) => (d.day === day ? { ...d, [field]: value } : d))
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isValid) return;
    setError('');
    setLoading(true);

    try {
      await setupService({
        categories: selectedCategories,
        skills,
        experience: experience ? Number(experience) : undefined,
        languages: languages.length > 0 ? languages : undefined,
        bio: bio.trim() || undefined,
        visitingCredits: Number(visitingCredits),
        emergencyAvailable,
        serviceRadius: Number(serviceRadius) || 10,
        workingDays: workingDays.length > 0 ? workingDays : undefined,
      });
      patchPartner({ isService: true });
      router.replace('/onboarding/documents' as any);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Input style ──────────────────────────────────────────────────────────
  const inputStyle = () => ({
    color: colors.text,
    borderColor: colors.backgroundElement,
    backgroundColor: colors.backgroundElement,
  });

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
                <ThemedText type="title">Your services</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Step 2 of 3 — Tell us what you do.
                </ThemedText>
              </View>

              {/* ── Categories ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Service Categories *</ThemedText>
                {loadingCategories ? (
                  <ActivityIndicator />
                ) : (
                  <View style={styles.chipRow}>
                    {categories.map((cat) => {
                      const selected = selectedCategories.includes(cat._id);
                      return (
                        <TouchableOpacity
                          key={cat._id}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected ? '#3b82f6' : colors.backgroundElement,
                              borderColor: selected ? '#3b82f6' : colors.backgroundElement,
                            },
                          ]}
                          onPress={() => {
                            setSelectedCategories((prev) =>
                              selected
                                ? prev.filter((id) => id !== cat._id)
                                : [...prev, cat._id]
                            );
                            setError('');
                          }}
                          activeOpacity={0.8}
                        >
                          <ThemedText
                            type="small"
                            style={{
                              color: selected ? '#fff' : colors.text,
                              fontWeight: '600',
                            }}
                          >
                            {cat.name}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* ── Skills ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Skills *</ThemedText>
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.tagInput, inputStyle()]}
                    placeholder="e.g. Plumbing"
                    placeholderTextColor={colors.textSecondary}
                    value={skillInput}
                    onChangeText={setSkillInput}
                    onSubmitEditing={addSkill}
                    onBlur={addSkill}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={addSkill}
                    disabled={!skillInput.trim()}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={styles.addBtnText}>Add</ThemedText>
                  </TouchableOpacity>
                </View>
                {skills.length > 0 && (
                  <View style={styles.tagList}>
                    {skills.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.tag, { backgroundColor: colors.backgroundSelected }]}
                        onPress={() => removeSkill(s)}
                      >
                        <ThemedText type="small">{s}  ✕</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Experience ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Years of Experience</ThemedText>
                <TextInput
                  style={[styles.input, inputStyle()]}
                  placeholder="e.g. 3"
                  placeholderTextColor={colors.textSecondary}
                  value={experience}
                  onChangeText={(v) => setExperience(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                />
              </View>

              {/* ── Languages ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Languages Spoken</ThemedText>
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.tagInput, inputStyle()]}
                    placeholder="e.g. Hindi"
                    placeholderTextColor={colors.textSecondary}
                    value={languageInput}
                    onChangeText={setLanguageInput}
                    onSubmitEditing={addLanguage}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={addLanguage}
                    disabled={!languageInput.trim()}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={styles.addBtnText}>Add</ThemedText>
                  </TouchableOpacity>
                </View>
                {languages.length > 0 && (
                  <View style={styles.tagList}>
                    {languages.map((l) => (
                      <TouchableOpacity
                        key={l}
                        style={[styles.tag, { backgroundColor: colors.backgroundSelected }]}
                        onPress={() => removeLanguage(l)}
                      >
                        <ThemedText type="small">{l}  ✕</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Bio ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Short Bio</ThemedText>
                <TextInput
                  style={[styles.textarea, inputStyle()]}
                  placeholder="Briefly describe your expertise and experience…"
                  placeholderTextColor={colors.textSecondary}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={300}
                />
                <ThemedText type="small" style={{ color: colors.textSecondary, textAlign: 'right' }}>
                  {bio.length}/300
                </ThemedText>
              </View>

              {/* ── Visiting Credits ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Visiting Credits (₹) *</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Amount you charge just for visiting the customer.
                </ThemedText>
                <TextInput
                  style={[styles.input, inputStyle()]}
                  placeholder="e.g. 150"
                  placeholderTextColor={colors.textSecondary}
                  value={visitingCredits}
                  onChangeText={(v) => { setVisitingCredits(v.replace(/\D/g, '')); setError(''); }}
                  keyboardType="number-pad"
                />
              </View>

              {/* ── Service Radius ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Service Radius (km)</ThemedText>
                <TextInput
                  style={[styles.input, inputStyle()]}
                  placeholder="Default: 10 km"
                  placeholderTextColor={colors.textSecondary}
                  value={serviceRadius}
                  onChangeText={(v) => setServiceRadius(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                />
              </View>

              {/* ── Emergency ── */}
              <View style={styles.field}>
                <TouchableOpacity
                  style={[
                    styles.toggleRow,
                    { backgroundColor: colors.backgroundElement },
                  ]}
                  onPress={() => setEmergencyAvailable((v) => !v)}
                  activeOpacity={0.8}
                >
                  <View style={styles.toggleLabel}>
                    <ThemedText type="smallBold">Available for Emergency?</ThemedText>
                    <ThemedText type="small" style={{ color: colors.textSecondary }}>
                      Clients can book you for urgent jobs
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.toggle,
                      { backgroundColor: emergencyAvailable ? '#3b82f6' : colors.backgroundSelected },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        { transform: [{ translateX: emergencyAvailable ? 20 : 2 }] },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* ── Working Days ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Working Days</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Tap a day to select it, then set your hours.
                </ThemedText>
                {DAYS.map((day) => {
                  const selected = workingDays.find((d) => d.day === day);
                  return (
                    <View key={day}>
                      <TouchableOpacity
                        style={[
                          styles.dayRow,
                          {
                            backgroundColor: selected
                              ? colors.backgroundSelected
                              : colors.backgroundElement,
                          },
                        ]}
                        onPress={() => toggleDay(day)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.dayCheck,
                            {
                              backgroundColor: selected ? '#3b82f6' : 'transparent',
                              borderColor: selected ? '#3b82f6' : colors.textSecondary,
                            },
                          ]}
                        >
                          {selected && (
                            <ThemedText type="small" style={{ color: '#fff', lineHeight: 16 }}>
                              ✓
                            </ThemedText>
                          )}
                        </View>
                        <ThemedText type="small" style={{ fontWeight: selected ? '600' : '400' }}>
                          {day}
                        </ThemedText>
                      </TouchableOpacity>

                      {selected && (
                        <View style={styles.timeRow}>
                          <View style={{ flex: 1, gap: 4 }}>
                            <ThemedText type="small" style={{ color: colors.textSecondary }}>
                              Start
                            </ThemedText>
                            <TextInput
                              style={[styles.timeInput, inputStyle()]}
                              value={selected.startTime}
                              onChangeText={(v) => updateDayTime(day, 'startTime', v)}
                              placeholder="09:00"
                              placeholderTextColor={colors.textSecondary}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                            />
                          </View>
                          <ThemedText type="default" style={styles.timeSep}>–</ThemedText>
                          <View style={{ flex: 1, gap: 4 }}>
                            <ThemedText type="small" style={{ color: colors.textSecondary }}>
                              End
                            </ThemedText>
                            <TextInput
                              style={[styles.timeInput, inputStyle()]}
                              value={selected.endTime}
                              onChangeText={(v) => updateDayTime(day, 'endTime', v)}
                              placeholder="18:00"
                              placeholderTextColor={colors.textSecondary}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* ── Validation hints ── */}
              {!isValid && validationHints.length > 0 && (
                <View style={styles.hintsBox}>
                  {validationHints.map((hint) => (
                    <ThemedText key={hint} type="small" style={styles.hintText}>
                      • {hint}
                    </ThemedText>
                  ))}
                </View>
              )}

              {/* ── Error ── */}
              {!!error && (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              )}

              {/* ── Submit ── */}
              <TouchableOpacity
                style={[styles.button, { opacity: !isValid || loading ? 0.5 : 1 }]}
                onPress={handleSubmit}
                disabled={!isValid || loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.buttonText}>Continue →</ThemedText>
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
  field: { gap: Spacing.two },
  input: {
    height: 52,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  textarea: {
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    fontSize: 16,
    minHeight: 100,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tagInput: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  addBtn: {
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Spacing.one,
  },
  priceRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  toggleLabel: { gap: 2, flex: 1 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    marginBottom: 4,
  },
  dayCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.two,
  },
  timeInput: {
    height: 44,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
    textAlign: 'center',
  },
  timeSep: {
    paddingBottom: 10,
    fontSize: 20,
  },
  errorText: {
    color: '#ef4444',
    marginTop: -Spacing.one,
  },
  hintsBox: {
    gap: 4,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#fef3c7',
  },
  hintText: {
    color: '#92400e',
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
