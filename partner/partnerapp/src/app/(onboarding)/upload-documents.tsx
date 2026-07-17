import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { useUploadDocuments } from "@/hooks/useUploadDocuments";
import { ROUTES } from "@/constants/routes";
import { colors, fonts, radii, spacing } from "@/constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type GallerySlot = "aadhaarFront" | "aadhaarBack" | "panImage";
type CameraSlot  = "selfie";

// ─── Field Label ──────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={fieldStyles.label}>
      {label}
      {required && <Text style={fieldStyles.required}> *</Text>}
    </Text>
  );
}

const fieldStyles = StyleSheet.create({
  label: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  required: { color: "#EF4444" },
});

// ─── Image Upload Slot ────────────────────────────────────────────────────────

function ImageSlotButton({
  uri,
  placeholder,
  icon,
  onPress,
}: {
  uri: string | null;
  placeholder: string;
  icon?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [imgStyles.slot, pressed && { opacity: 0.75 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={imgStyles.preview} resizeMode="cover" />
          <View style={imgStyles.editBadge}>
            <Text style={imgStyles.editBadgeText}>✎ Change</Text>
          </View>
        </>
      ) : (
        <View style={imgStyles.empty}>
          <Text style={imgStyles.emptyIcon}>{icon ?? "📷"}</Text>
          <Text style={imgStyles.emptyLabel}>{placeholder}</Text>
        </View>
      )}
    </Pressable>
  );
}

const imgStyles = StyleSheet.create({
  slot: {
    height: 130,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.navInactive,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  emptyIcon: { fontSize: 28 },
  emptyLabel: {
    fontFamily: fonts.jostMedium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
  preview: { width: "100%", height: "100%" },
  editBadge: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: spacing.xs,
    alignItems: "center",
  },
  editBadgeText: { fontFamily: fonts.jostSemiBold, fontSize: 12, color: "#fff" },
});

// ─── Selfie Slot ──────────────────────────────────────────────────────────────
// Larger, square, with a camera-specific empty state

function SelfieSlotButton({
  uri,
  onPress,
}: {
  uri: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [selfieStyles.slot, pressed && { opacity: 0.75 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Take a selfie"
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={selfieStyles.preview} resizeMode="cover" />
          <View style={selfieStyles.editBadge}>
            <Text style={selfieStyles.editBadgeText}>📸 Retake selfie</Text>
          </View>
        </>
      ) : (
        <View style={selfieStyles.empty}>
          <Text style={selfieStyles.icon}>🤳</Text>
          <Text style={selfieStyles.title}>Take a selfie</Text>
          <Text style={selfieStyles.hint}>
            Look straight at the camera in good lighting.{"\n"}
            This is used to verify your identity.
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const selfieStyles = StyleSheet.create({
  slot: {
    height: 200,
    borderRadius: radii.md,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primary + "66",
    backgroundColor: colors.primary + "06",
    overflow: "hidden",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.md },
  icon: { fontSize: 40 },
  title: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.primary },
  hint: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 2,
  },
  preview: { width: "100%", height: "100%" },
  editBadge: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: spacing.xs,
    alignItems: "center",
  },
  editBadgeText: { fontFamily: fonts.jostSemiBold, fontSize: 12, color: "#fff" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UploadDocumentsScreen() {
  const { submit, loading, error, clearError } = useUploadDocuments();

  // Aadhaar
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);

  // Selfie (required)
  const [selfie, setSelfie] = useState<string | null>(null);

  // PAN (optional)
  const [panNumber, setPanNumber] = useState("");
  const [panImage, setPanImage] = useState<string | null>(null);

  // ── Gallery picker (Aadhaar / PAN) ─────────────────────────────────────────
  const pickFromGallery = useCallback(async (slot: GallerySlot) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Allow access to your photo library to upload documents.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      // No base64 — we use the file URI directly
    });

    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;

    if (slot === "aadhaarFront")     setAadhaarFront(uri);
    else if (slot === "aadhaarBack") setAadhaarBack(uri);
    else if (slot === "panImage")    setPanImage(uri);
  }, []);

  // ── Camera (selfie only) ────────────────────────────────────────────────────
  const takeSelfie = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera permission required", "Allow camera access to take your selfie.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;
    setSelfie(result.assets[0].uri);
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────────
  const aadhaarValid = /^\d{12}$/.test(aadhaarNumber);
  const panValid     = panNumber === "" || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase());

  const canSubmit =
    aadhaarValid       &&
    aadhaarFront !== null &&
    aadhaarBack  !== null &&
    selfie       !== null &&
    panValid;

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!aadhaarFront || !aadhaarBack || !selfie) return;

    const success = await submit({
      aadhaarNumber: aadhaarNumber.trim(),
      aadhaarFront,
      aadhaarBack,
      selfie,
      panNumber: panNumber.trim() ? panNumber.trim().toUpperCase() : undefined,
      panImage:  panImage ?? undefined,
    });

    if (success) {
      router.replace(ROUTES.APP.HOME as any);
    }
  }, [submit, aadhaarNumber, aadhaarFront, aadhaarBack, selfie, panNumber, panImage]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* ── Hero band ─────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.triTopRight} pointerEvents="none" />
          <View style={styles.triTopRightInner} pointerEvents="none" />
          <View style={styles.triBottomLeft} pointerEvents="none" />
          <View style={styles.triMidRight} pointerEvents="none" />
          <View style={styles.triMidLeft} pointerEvents="none" />
          <View style={styles.triBottomRight} pointerEvents="none" />
          <Text style={styles.appName}>LocalHelpers Partner</Text>
          <Text style={styles.heroTitle}>Verify your{"\n"}identity</Text>
          <Text style={styles.heroSub}>Step 3 of 3 — Upload KYC documents</Text>
        </View>

        {/* ── White card ────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.handle} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {/* ── Info banner ──────────────────────────────────────────── */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                🔒 Your documents are encrypted and reviewed only by the LocalHelpers team for identity verification.
              </Text>
            </View>

            {/* ════════════════════════════════════════════════════════════
                SELFIE  (required, camera-only)
            ════════════════════════════════════════════════════════════ */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🤳 Live Selfie</Text>
              <Text style={styles.sectionSub}>Required — used to match your face with your Aadhaar</Text>
            </View>

            <SelfieSlotButton uri={selfie} onPress={takeSelfie} />

            {/* ════════════════════════════════════════════════════════════
                AADHAAR
            ════════════════════════════════════════════════════════════ */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🪪 Aadhaar Card</Text>
              <Text style={styles.sectionSub}>Required for identity verification</Text>
            </View>

            <FieldLabel label="Aadhaar Number" required />
            <TextInput
              style={[
                styles.input,
                aadhaarNumber.length > 0 && !aadhaarValid && styles.inputError,
              ]}
              placeholder="12-digit Aadhaar number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={12}
              value={aadhaarNumber}
              onChangeText={(t) => { clearError(); setAadhaarNumber(t.replace(/\D/g, "")); }}
              accessibilityLabel="Aadhaar number"
            />
            {aadhaarNumber.length > 0 && !aadhaarValid && (
              <Text style={styles.fieldError}>Must be exactly 12 digits</Text>
            )}

            <View style={styles.imageRow}>
              <View style={styles.imageCol}>
                <FieldLabel label="Front side" required />
                <ImageSlotButton
                  uri={aadhaarFront}
                  placeholder={"Upload front\nof Aadhaar"}
                  onPress={() => pickFromGallery("aadhaarFront")}
                />
              </View>
              <View style={styles.imageCol}>
                <FieldLabel label="Back side" required />
                <ImageSlotButton
                  uri={aadhaarBack}
                  placeholder={"Upload back\nof Aadhaar"}
                  onPress={() => pickFromGallery("aadhaarBack")}
                />
              </View>
            </View>

            {/* ════════════════════════════════════════════════════════════
                PAN  (optional)
            ════════════════════════════════════════════════════════════ */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📋 PAN Card</Text>
              <Text style={styles.sectionSub}>Optional — add now or later from your profile</Text>
            </View>

            <FieldLabel label="PAN Number" />
            <TextInput
              style={[
                styles.input,
                panNumber.length > 0 && !panValid && styles.inputError,
              ]}
              placeholder="e.g. ABCDE1234F"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              maxLength={10}
              value={panNumber}
              onChangeText={(t) => { clearError(); setPanNumber(t.toUpperCase()); }}
              accessibilityLabel="PAN number"
            />
            {panNumber.length > 0 && !panValid && (
              <Text style={styles.fieldError}>Invalid format — expected ABCDE1234F</Text>
            )}

            <View style={styles.panImageRow}>
              <FieldLabel label="PAN Card image" />
              <ImageSlotButton
                uri={panImage}
                placeholder="Upload PAN card"
                onPress={() => pickFromGallery("panImage")}
              />
            </View>

            {/* ── Error banner ─────────────────────────────────────── */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* ── Submit ───────────────────────────────────────────── */}
            <Pressable
              style={[styles.submitBtn, (!canSubmit || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
              accessibilityRole="button"
              accessibilityLabel="Submit documents"
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.submitBtnText}>Submit Documents →</Text>}
            </Pressable>

            {!canSubmit && (
              <Text style={styles.validationNote}>
                Add your Aadhaar number, both Aadhaar photos, and a selfie to continue.
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

  // ── Hero ──────────────────────────────────────────────────────────────────
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
    fontFamily: fonts.jostRegular, fontSize: 14,
    color: "rgba(255,255,255,0.65)", marginTop: spacing.xs, lineHeight: 20,
  },

  // ── Geometric decorations ─────────────────────────────────────────────────
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

  // ── White card ────────────────────────────────────────────────────────────
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

  // ── Info banner ───────────────────────────────────────────────────────────
  infoBanner: {
    backgroundColor: colors.primary + "10",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary + "30",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoBannerText: {
    fontFamily: fonts.jostRegular, fontSize: 13, color: colors.primary, lineHeight: 20,
  },

  // ── Section headers ───────────────────────────────────────────────────────
  sectionHeader: { marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.textPrimary },
  sectionSub: {
    fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: 2,
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  input: {
    fontFamily: fonts.jostRegular, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md - 2,
    borderWidth: 1.5, borderColor: colors.navInactive + "66", marginBottom: spacing.xs,
  },
  inputError: { borderColor: "#EF4444" },
  fieldError: {
    fontFamily: fonts.jostRegular, color: "#EF4444", fontSize: 12, marginBottom: spacing.xs,
  },

  // ── Image upload slots ────────────────────────────────────────────────────
  imageRow: {
    flexDirection: "row", gap: spacing.sm,
    marginTop: spacing.sm, marginBottom: spacing.sm,
  },
  imageCol: { flex: 1 },
  panImageRow: { marginTop: spacing.sm, marginBottom: spacing.sm },

  // ── Error banner ──────────────────────────────────────────────────────────
  errorBanner: {
    backgroundColor: "#FEE2E2", borderRadius: radii.sm,
    padding: spacing.md, marginTop: spacing.sm,
  },
  errorBannerText: { fontFamily: fonts.jostMedium, color: "#991B1B", fontSize: 13 },

  // ── Submit ────────────────────────────────────────────────────────────────
  submitBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: {
    fontFamily: fonts.jakartaBold, color: colors.white, fontSize: 15, letterSpacing: 0.3,
  },
  validationNote: {
    fontFamily: fonts.jostRegular, fontSize: 12,
    color: colors.textSecondary, textAlign: "center",
    marginTop: spacing.xs, lineHeight: 18,
  },
});
