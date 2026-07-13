import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import {
  getCategories,
  getNearbyPartners,
  createBooking,
  Category,
  NearbyPartner,
} from "@/constants/booking.api";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Produce next N whole-hour slots starting from now+1h */
function getTimeSlots(count = 8): Date[] {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setHours(d.getHours() + i);
    return d;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const colors = useTheme();
  return (
    <View style={indicator.row}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const active = i + 1 === step;
        const done = i + 1 < step;
        return (
          <View key={i} style={indicator.item}>
            <View
              style={[
                indicator.circle,
                {
                  backgroundColor:
                    active || done ? "#3b82f6" : colors.backgroundElement,
                  borderColor:
                    active || done ? "#3b82f6" : colors.backgroundElement,
                },
              ]}
            >
              {done ? (
                <ThemedText style={indicator.circleText}>✓</ThemedText>
              ) : (
                <ThemedText
                  style={[
                    indicator.circleText,
                    { color: active ? "#fff" : colors.text },
                  ]}
                >
                  {i + 1}
                </ThemedText>
              )}
            </View>
            <ThemedText
              type="small"
              style={{ color: active ? "#3b82f6" : colors.text }}
            >
              {i === 0 ? "Details" : "Pick Partner"}
            </ThemedText>
            {i < TOTAL_STEPS - 1 && (
              <View
                style={[
                  indicator.line,
                  { backgroundColor: done ? "#3b82f6" : colors.backgroundElement },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const indicator = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    paddingVertical: Spacing.two,
  },
  item: {
    alignItems: "center",
    gap: Spacing.one,
    flex: 1,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  line: {
    position: "absolute",
    top: 15,
    right: -50,
    width: 100,
    height: 2,
    zIndex: -1,
  },
});

// ─── Partner Card ─────────────────────────────────────────────────────────────

function PartnerCard({
  partner,
  selected,
  onPress,
}: {
  partner: NearbyPartner;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        card.root,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: selected ? "#3b82f6" : "transparent",
          borderWidth: 2,
        },
      ]}
    >
      {/* Avatar placeholder */}
      <View
        style={[
          card.avatar,
          { backgroundColor: selected ? "#3b82f6" : colors.backgroundSelected },
        ]}
      >
        <ThemedText style={{ color: selected ? "#fff" : colors.text, fontWeight: "700" }}>
          {partner.fullName?.charAt(0).toUpperCase() ?? "?"}
        </ThemedText>
      </View>

      <View style={card.info}>
        <ThemedText type="smallBold">{partner.fullName}</ThemedText>

        {/* Rating + distance */}
        <View style={card.row}>
          {!!partner.averageRating && (
            <ThemedText type="small" style={{ color: "#f59e0b" }}>
              ★ {partner.averageRating.toFixed(1)}
            </ThemedText>
          )}
          {!!partner.totalReviews && (
            <ThemedText type="small" style={{ color: colors.text }}>
              {" "}
              ({partner.totalReviews})
            </ThemedText>
          )}
          <ThemedText type="small" style={{ color: colors.text }}>
            {"  "}· {partner.distanceKm.toFixed(1)} km away
          </ThemedText>
        </View>

        {/* Emergency badge */}
        {partner.emergencyAvailable && (
          <View style={[card.badge, { backgroundColor: "#fef2f2" }]}>
            <ThemedText type="small" style={{ color: "#ef4444", fontWeight: "600" }}>
              ⚡ Emergency available
            </ThemedText>
          </View>
        )}

        {/* Categories */}
        {partner.categories?.length > 0 && (
          <ThemedText type="small" style={{ color: colors.text, marginTop: 2 }}>
            {partner.categories.map((c) => c.name).join(", ")}
          </ThemedText>
        )}

        {/* Visiting credits */}
        {!!partner.visitingCredits && (
          <ThemedText type="small" style={{ color: "#3b82f6", fontWeight: "600" }}>
            ₹{partner.visitingCredits} visiting charge
          </ThemedText>
        )}
      </View>

      {selected && (
        <View style={card.check}>
          <ThemedText style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
            ✓
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const card = StyleSheet.create({
  root: {
    flexDirection: "row",
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: "flex-start",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: Spacing.one },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  badge: {
    alignSelf: "flex-start",
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    marginTop: Spacing.one,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreateBookingScreen() {
  const router = useRouter();
  const colors = useTheme();
  const timeSlots = getTimeSlots(8);

  // ── Step 1: Booking details ────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Date>(timeSlots[0]);
  const [isEmergency, setIsEmergency] = useState(false);

  // ── Step 2: Partner selection ──────────────────────────────────────────────
  const [partners, setPartners] = useState<NearbyPartner[]>([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerError, setPartnerError] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<NearbyPartner | null>(null);

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Load categories on mount ───────────────────────────────────────────────
  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.data.categories))
      .catch(() => setError("Could not load categories. Please try again."))
      .finally(() => setCatLoading(false));
  }, []);

  // ── Slide animation between steps ─────────────────────────────────────────
  const animateToStep = (nextStep: number) => {
    const direction = nextStep > step ? 1 : -1;
    slideAnim.setValue(direction * 300);
    setStep(nextStep);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  // ── Step 1 → Step 2: fetch nearby partners ─────────────────────────────────
  const handleNext = async () => {
    if (!selectedCategory) {
      setError("Please select a category.");
      return;
    }
    if (!scheduledAt) {
      setError("Please choose a time slot.");
      return;
    }
    setError("");
    setPartnerError("");
    setPartnerLoading(true);
    animateToStep(2);

    try {
      // Always try to get live GPS — it's required if the customer has no
      // stored currentLocation on the backend.
      let lng: number | undefined;
      let lat: number | undefined;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lng = pos.coords.longitude;
        lat = pos.coords.latitude;
      }

      // If we couldn't get GPS, the backend will try the stored location.
      // If that's also missing, it returns a 400 which the catch block shows.
      const res = await getNearbyPartners({
        ...(lng !== undefined && lat !== undefined ? { lng, lat } : {}),
        categoryId: selectedCategory._id,
      });

      console.log("📍 Nearby partners response:", JSON.stringify(res.data));
      console.log("🔎 Fetching with categoryId:", selectedCategory._id, "coords:", { lng, lat });

      const list = res.data.services ?? [];
      setPartners(list);
      if (list.length === 0) {
        setPartnerError(
          "No available partners found near you for this category. Try a different category or check back later."
        );
      }
    } catch (err: any) {
      console.error("getNearbyPartners error:", err?.response?.data ?? err);
      setPartnerError(
        err?.response?.data?.message ??
          "Could not load nearby partners. Please try again."
      );
    } finally {
      setPartnerLoading(false);
    }
  };

  // ── Submit booking ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedPartner) {
      setError("Please select a partner.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      await createBooking({
        partnerId: selectedPartner._id,
        categoryId: selectedCategory?._id,
        description: description.trim() || undefined,
        scheduledAt: scheduledAt.toISOString(),
        isEmergency,
      });
      // Replace so Back doesn't come back to this form
      router.replace("/");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Failed to create booking. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    color: colors.text,
    borderColor: colors.backgroundElement,
    backgroundColor: colors.backgroundElement,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* ── Header ── */}
          <View
            style={[
              styles.header,
              { borderBottomColor: colors.backgroundElement },
            ]}
          >
            {step === 2 ? (
              <TouchableOpacity
                onPress={() => {
                  setError("");
                  animateToStep(1);
                }}
                hitSlop={12}
              >
                <ThemedText type="small" style={{ color: "#3b82f6" }}>
                  ← Back
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                <ThemedText type="small" style={{ color: "#3b82f6" }}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
            )}
            <ThemedText type="smallBold" style={styles.headerTitle}>
              New Booking
            </ThemedText>
            <View style={{ width: 50 }} />
          </View>

          {/* ── Step Indicator ── */}
          <View style={styles.stepWrap}>
            <StepIndicator step={step} />
          </View>

          {/* ── Content ── */}
          <Animated.View
            style={[styles.animWrap, { transform: [{ translateX: slideAnim }] }]}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.content}>
                {/* ════ STEP 1 ════ */}
                {step === 1 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <ThemedText type="title">What do you need?</ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: colors.text }}
                      >
                        Pick a category and describe the issue.
                      </ThemedText>
                    </View>

                    {/* Category */}
                    <View style={styles.field}>
                      <ThemedText type="smallBold">Category *</ThemedText>
                      {catLoading ? (
                        <ActivityIndicator
                          size="small"
                          color="#3b82f6"
                          style={{ alignSelf: "flex-start", marginTop: 4 }}
                        />
                      ) : categories.length === 0 ? (
                        <ThemedText type="small" style={{ color: "#ef4444" }}>
                          No categories available.
                        </ThemedText>
                      ) : (
                        <View style={styles.categoryGrid}>
                          {categories.map((cat) => {
                            const active = selectedCategory?._id === cat._id;
                            return (
                              <TouchableOpacity
                                key={cat._id}
                                style={[
                                  styles.categoryChip,
                                  {
                                    backgroundColor: active
                                      ? "#3b82f6"
                                      : colors.backgroundElement,
                                    borderColor: active
                                      ? "#3b82f6"
                                      : colors.backgroundElement,
                                  },
                                ]}
                                onPress={() => {
                                  setSelectedCategory(cat);
                                  setError("");
                                }}
                                activeOpacity={0.8}
                              >
                                {cat.icon ? (
                                  <ThemedText style={styles.catIcon}>
                                    {cat.icon}
                                  </ThemedText>
                                ) : null}
                                <ThemedText
                                  type="small"
                                  style={{
                                    color: active ? "#fff" : colors.text,
                                    fontWeight: "600",
                                    textAlign: "center",
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

                    {/* Description */}
                    <View style={styles.field}>
                      <ThemedText type="smallBold">
                        Description{" "}
                        <ThemedText
                          type="small"
                          style={{ color: colors.text }}
                        >
                          (optional)
                        </ThemedText>
                      </ThemedText>
                      <TextInput
                        style={[styles.textarea, inputStyle]}
                        placeholder="Describe the problem, e.g. 'Leaking pipe under sink'"
                        placeholderTextColor={colors.text}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        returnKeyType="done"
                      />
                    </View>

                    {/* Schedule */}
                    <View style={styles.field}>
                      <ThemedText type="smallBold">Schedule *</ThemedText>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.slotRow}
                      >
                        {timeSlots.map((slot, i) => {
                          const active =
                            scheduledAt.getTime() === slot.getTime();
                          return (
                            <TouchableOpacity
                              key={i}
                              style={[
                                styles.slotChip,
                                {
                                  backgroundColor: active
                                    ? "#3b82f6"
                                    : colors.backgroundElement,
                                },
                              ]}
                              onPress={() => setScheduledAt(slot)}
                              activeOpacity={0.8}
                            >
                              <ThemedText
                                type="small"
                                style={{
                                  color: active ? "#fff" : colors.text,
                                  fontWeight: "600",
                                }}
                              >
                                {slot.toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </ThemedText>
                              <ThemedText
                                type="small"
                                style={{
                                  color: active ? "#dbeafe" : colors.text,
                                  fontSize: 11,
                                }}
                              >
                                {slot.toLocaleDateString("en-IN", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </ThemedText>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Emergency toggle */}
                    <View style={styles.field}>
                      <ThemedText type="smallBold">Priority</ThemedText>
                      <View style={styles.toggleRow}>
                        {(
                          [
                            { label: "Scheduled", value: false },
                            { label: "⚡ Emergency", value: true },
                          ] as const
                        ).map(({ label, value }) => {
                          const active = isEmergency === value;
                          return (
                            <TouchableOpacity
                              key={label}
                              style={[
                                styles.toggleChip,
                                {
                                  backgroundColor: active
                                    ? value
                                      ? "#ef4444"
                                      : "#3b82f6"
                                    : colors.backgroundElement,
                                  borderColor: active
                                    ? value
                                      ? "#ef4444"
                                      : "#3b82f6"
                                    : colors.backgroundElement,
                                },
                              ]}
                              onPress={() => setIsEmergency(value)}
                              activeOpacity={0.8}
                            >
                              <ThemedText
                                type="small"
                                style={{
                                  color: active ? "#fff" : colors.text,
                                  fontWeight: "600",
                                }}
                              >
                                {label}
                              </ThemedText>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {isEmergency && (
                        <ThemedText
                          type="small"
                          style={{ color: "#ef4444" }}
                        >
                          Emergency bookings are prioritised but may cost more.
                        </ThemedText>
                      )}
                    </View>

                    {/* Error */}
                    {!!error && (
                      <ThemedText type="small" style={styles.errorText}>
                        {error}
                      </ThemedText>
                    )}

                    {/* Next button */}
                    <TouchableOpacity
                      style={[
                        styles.button,
                        { opacity: !selectedCategory ? 0.5 : 1 },
                      ]}
                      onPress={handleNext}
                      disabled={!selectedCategory}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.buttonText}>
                        Next: Pick a Partner →
                      </ThemedText>
                    </TouchableOpacity>
                  </>
                )}

                {/* ════ STEP 2 ════ */}
                {step === 2 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <ThemedText type="title">Choose a partner</ThemedText>
                      <ThemedText type="small" style={{ color: colors.text }}>
                        {selectedCategory?.name} ·{" "}
                        {isEmergency ? "⚡ Emergency" : "Scheduled"} ·{" "}
                        {formatDate(scheduledAt)}
                      </ThemedText>
                    </View>

                    {partnerLoading ? (
                      <View style={styles.center}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <ThemedText
                          type="small"
                          style={{ color: colors.text, marginTop: Spacing.two }}
                        >
                          Finding partners near you…
                        </ThemedText>
                      </View>
                    ) : partnerError ? (
                      <View style={styles.center}>
                        <ThemedText
                          type="small"
                          style={{ color: "#ef4444", textAlign: "center" }}
                        >
                          {partnerError}
                        </ThemedText>
                        <TouchableOpacity
                          style={[
                            styles.button,
                            { marginTop: Spacing.three, width: "100%" },
                          ]}
                          onPress={handleNext}
                        >
                          <ThemedText style={styles.buttonText}>
                            Retry
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <ThemedText
                          type="small"
                          style={{ color: colors.text }}
                        >
                          {partners.length} partner
                          {partners.length !== 1 ? "s" : ""} available
                        </ThemedText>

                        {partners.map((p) => (
                          <PartnerCard
                            key={p._id}
                            partner={p}
                            selected={selectedPartner?._id === p._id}
                            onPress={() => {
                              setSelectedPartner(p);
                              setError("");
                            }}
                          />
                        ))}

                        {!!error && (
                          <ThemedText type="small" style={styles.errorText}>
                            {error}
                          </ThemedText>
                        )}

                        <TouchableOpacity
                          style={[
                            styles.button,
                            { opacity: !selectedPartner || submitting ? 0.5 : 1 },
                          ]}
                          onPress={handleSubmit}
                          disabled={!selectedPartner || submitting}
                          activeOpacity={0.8}
                        >
                          {submitting ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <ThemedText style={styles.buttonText}>
                              Confirm Booking
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: "center" },
  kav: {
    flex: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
  },
  headerTitle: {
    textAlign: "center",
    flex: 1,
  },
  stepWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  animWrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  content: { gap: Spacing.three },
  sectionHeader: { gap: Spacing.two },
  field: { gap: Spacing.two },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  categoryChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    alignItems: "center",
    minWidth: "30%",
    flex: 1,
    gap: Spacing.one,
  },
  catIcon: {
    fontSize: 22,
  },
  textarea: {
    minHeight: 80,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    fontSize: 16,
  },
  slotRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  slotChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: "center",
    gap: 2,
    minWidth: 80,
  },
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  toggleChip: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#ef4444",
  },
  button: {
    height: 52,
    borderRadius: Spacing.two,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.two,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  center: {
    alignItems: "center",
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
});
