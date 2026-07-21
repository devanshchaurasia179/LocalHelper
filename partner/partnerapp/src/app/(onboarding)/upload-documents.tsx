/**
 * upload-documents.tsx  (onboarding Step 3)
 *
 * Fully configuration-driven. The screen:
 *   1. Calls GET /partner/verification to receive the document list
 *   2. Renders documents.map(doc => <UploadCard ... />)
 *   3. Never checks doc.key, never hardcodes any document name
 *
 * Upload flow:
 *   - User taps the CTA on any UploadCard
 *   - An ActionSheet appears: "Camera" or "Choose from gallery"
 *   - Image picker resolves a local file URI
 *   - useDocumentUpload calls POST /partner/verification/documents
 *   - React Query cache is patched in place — no extra GET needed
 *   - When sessionStatus hits "Under Review", partner status is invalidated
 *     and VerificationGate re-routes automatically
 *
 * Number field validation:
 *   - State is keyed by documentTypeId — independent per card
 *   - Validation runs only at upload time (no live regex per-keystroke
 *     because the regex lives on the backend and we don't re-fetch it)
 *
 * Navigation after submission:
 *   - When all required docs are uploaded, sessionStatus → "Under Review"
 *   - useDocumentUpload invalidates PARTNER_STATUS_QUERY_KEY
 *   - VerificationGate (watched by the root index) redirects to under-review
 *   - We also imperatively navigate as a safety net
 */

import React, { useCallback, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useVerification } from "@/hooks/useVerification";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { UploadCard } from "@/components/verification/UploadCard";
import { ROUTES } from "@/constants/routes";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import type { VerificationDocument } from "@/types/verification";

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function UploadDocumentsScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useVerification();
  const { upload, isUploading } = useDocumentUpload();

  /**
   * numberValues: keyed by documentTypeId — one entry per card that has
   * hasNumberField === true. Independent state per card.
   * Format: { [documentTypeId]: string }
   */
  const [numberValues, setNumberValues] = useState<Record<string, string>>({});
  const [numberErrors, setNumberErrors] = useState<Record<string, string | null>>({});

  // Ref to the ScrollView so we can scroll to a card on error
  const scrollRef = useRef<ScrollView>(null);

  // ── Number field helpers ────────────────────────────────────────────────
  const getNumberValue = (doc: VerificationDocument) =>
    numberValues[doc.documentTypeId] ??
    doc.numberValue ??   // pre-fill from previous upload
    "";

  const setNumberValue = (docTypeId: string, value: string) => {
    setNumberValues((prev) => ({ ...prev, [docTypeId]: value }));
    // Clear error on every keystroke
    setNumberErrors((prev) => ({ ...prev, [docTypeId]: null }));
  };

  // ── Image picker ────────────────────────────────────────────────────────
  /**
   * Opens the platform action sheet (iOS) or Alert (Android) to let the user
   * choose between camera and gallery. Returns a { uri, mimeType } tuple or
   * null if the user cancelled.
   *
   * We never hardcode "this document uses camera only". All documents offer
   * both options. The backend can add a captureMode field in future if needed.
   */
  const pickFile = useCallback(
    async (
      doc: VerificationDocument
    ): Promise<{ uri: string; mimeType: string } | null> => {
      // ── Check whether PDF is accepted for this document ─────────────────
      // acceptedTypes comes from the backend — e.g. ["image/jpeg", "application/pdf"]
      const acceptsPdf = doc.acceptedTypes.includes("application/pdf");

      // ── Show picker type choice ──────────────────────────────────────────
      const choice = await showPickerChoice(acceptsPdf);
      if (!choice) return null;

      if (choice === "camera") {
        const { status } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Camera Permission",
            "Allow camera access in Settings to take photos."
          );
          return null;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.85,
        });
        if (result.canceled || !result.assets?.[0]) return null;
        return {
          uri: result.assets[0].uri,
          mimeType: result.assets[0].mimeType ?? "image/jpeg",
        };
      }

      // gallery
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Photo Library",
          "Allow photo library access in Settings to upload documents."
        );
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: acceptsPdf
          ? ImagePicker.MediaTypeOptions.All
          : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: !acceptsPdf, // PDFs cannot be cropped
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return null;
      return {
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType ?? "image/jpeg",
      };
    },
    []
  );

  // ── Handle upload for any document card ────────────────────────────────
  /**
   * Called by UploadCard's onUpload prop.
   * This function is the ONLY upload handler — it handles every document type
   * through the same generic pipeline.
   */
  const handleUpload = useCallback(
    async (doc: VerificationDocument) => {
      // ── 1. Validate number field if required ─────────────────────────────
      if (doc.hasNumberField) {
        const value = getNumberValue(doc).trim();
        if (!value) {
          setNumberErrors((prev) => ({
            ...prev,
            [doc.documentTypeId]: `${doc.numberFieldLabel ?? "Number"} is required`,
          }));
          return;
        }
        // Note: we don't run the regex client-side — the backend validates it
        // and returns a clear error message. Avoids duplicating regex logic.
      }

      // ── 2. Pick file ──────────────────────────────────────────────────────
      const file = await pickFile(doc);
      if (!file) return; // user cancelled

      // ── 3. Upload ─────────────────────────────────────────────────────────
      const result = await upload({
        fileUri:        file.uri,
        mimeType:       file.mimeType,
        documentTypeId: doc.documentTypeId,
        side:           doc.side,
        numberValue:    doc.hasNumberField
          ? getNumberValue(doc).trim()
          : undefined,
      });

      if (result.ok) {
        Toast.show({
          type: "success",
          text1: "Uploaded successfully",
          text2: doc.title,
          visibilityTime: 2500,
        });

        // If session transitioned to Under Review, navigate there
        if (
          result.sessionStatus === "Under Review" ||
          result.sessionStatus === "Re-submitted"
        ) {
          router.replace(ROUTES.VERIFICATION.UNDER_REVIEW as any);
        }
      } else {
        Toast.show({
          type: "error",
          text1: "Upload failed",
          text2: result.message,
          visibilityTime: 3500,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upload, pickFile, numberValues]
  );

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <DocumentsSkeleton />
      </SafeAreaView>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}>
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={colors.error}
            />
          </View>
          <Text style={styles.errorTitle}>Unable to Load Documents</Text>
          <Text style={styles.errorMessage}>
            {(error as any)?.message ??
              "Check your connection and try again."}
          </Text>
          <Pressable
            style={[styles.retryBtn, isRefetching && { opacity: 0.7 }]}
            onPress={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.retryBtnText}>Try Again</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { documents, banner, progress } = data;

  // Only show documents that still need action — exclude already-approved ones.
  // Partners should only see missing, pending, under_review, or rejected docs.
  const actionableDocuments = documents.filter(
    (d) => d.uploadStatus !== "approved"
  );

  const missingRequired = actionableDocuments.filter(
    (d) => d.isRequired && d.uploadStatus === "missing"
  ).length;

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>

      {/* ── Hero band ───────────────────────────────────────────────────── */}
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

      {/* ── White card ──────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.handle} />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Security notice ─────────────────────────────────────── */}
          <View style={styles.securityBanner}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
            <Text style={styles.securityText}>
              Encrypted & reviewed only by the LocalHelpers team
            </Text>
          </View>

          {/* ── Status banner from backend ──────────────────────────── */}
          <BannerCard type={banner.type} title={banner.title} message={banner.message} />

          {/* ── Progress bar ─────────────────────────────────────────── */}
          <ProgressBar
            uploaded={progress.uploaded}
            total={progress.total}
            percentage={progress.percentage}
          />

          {/* ── Document cards — only non-approved documents shown. ──────── */}
          {actionableDocuments.map((doc) => (
            <UploadCard
              key={doc.key}
              doc={doc}
              onUpload={handleUpload}
              isUploading={isUploading(doc.documentTypeId, doc.side)}
              numberValue={getNumberValue(doc)}
              onNumberChange={(v) => setNumberValue(doc.documentTypeId, v)}
              numberError={numberErrors[doc.documentTypeId]}
            />
          ))}

          {/* ── Remaining hint ────────────────────────────────────────── */}
          {missingRequired > 0 && (
            <Animated.View entering={FadeIn} style={styles.remainingHint}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.remainingHintText}>
                {missingRequired} required document
                {missingRequired > 1 ? "s" : ""} remaining
              </Text>
            </Animated.View>
          )}

          {/* ── All approved message ──────────────────────────────────────── */}
          {actionableDocuments.length === 0 && (
            <Animated.View entering={FadeIn} style={styles.remainingHint}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={colors.success ?? "#16A34A"}
              />
              <Text style={styles.remainingHintText}>
                All documents have been approved
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </View>

      <Toast />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Banner driven entirely by backend banner.type — no status string checks */
function BannerCard({
  type,
  title,
  message,
}: {
  type: string;
  title: string;
  message: string;
}) {
  const config = {
    info:    { bg: colors.primary + "0D", border: colors.primary + "33", icon: "information-circle-outline" as const, titleColor: colors.primary, msgColor: colors.primary },
    warning: { bg: "#FFFBEB",             border: "#FDE68A",              icon: "time-outline" as const,               titleColor: "#92400E",      msgColor: "#78350F"  },
    success: { bg: colors.successLight,   border: colors.successBorder,   icon: "checkmark-circle-outline" as const,   titleColor: colors.successDark, msgColor: colors.successDark },
    error:   { bg: colors.errorLight,     border: colors.errorBorder,     icon: "alert-circle-outline" as const,       titleColor: colors.errorDark,   msgColor: colors.errorDark },
  } as const;

  const c = config[type as keyof typeof config] ?? config.info;

  return (
    <View style={[bannerStyles.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Ionicons name={c.icon} size={20} color={c.titleColor} style={{ marginTop: 1 }} />
      <View style={bannerStyles.content}>
        <Text style={[bannerStyles.title, { color: c.titleColor }]}>{title}</Text>
        <Text style={[bannerStyles.message, { color: c.msgColor }]}>{message}</Text>
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  content: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.jakartaSemiBold, fontSize: 14 },
  message: { fontFamily: fonts.jostRegular, fontSize: 13, lineHeight: 19 },
});

/** Progress bar: "X of Y required documents uploaded" */
function ProgressBar({
  uploaded,
  total,
  percentage,
}: {
  uploaded: number;
  total: number;
  percentage: number;
}) {
  return (
    <View style={progressStyles.wrap}>
      <View style={progressStyles.labelRow}>
        <Text style={progressStyles.label}>Required documents</Text>
        <Text style={progressStyles.count}>
          {uploaded}/{total}
        </Text>
      </View>
      <View style={progressStyles.track}>
        <View
          style={[
            progressStyles.fill,
            { width: `${percentage}%` as any },
            percentage === 100 && progressStyles.fillComplete,
          ]}
        />
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, gap: spacing.xs },
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary },
  count:  { fontFamily: fonts.jakartaSemiBold, fontSize: 12, color: colors.primary },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  fillComplete: {
    backgroundColor: colors.success,
  },
});

/** Skeleton loader — shown while GET /partner/verification is in flight */
function DocumentsSkeleton() {
  return (
    <View style={skeletonStyles.wrap}>
      <View style={skeletonStyles.heroPatch} />
      <View style={skeletonStyles.body}>
        <View style={[skeletonStyles.line, { width: "60%", height: 18 }]} />
        <View style={[skeletonStyles.line, { width: "90%", height: 10 }]} />
        <View style={[skeletonStyles.line, { width: "75%", height: 10 }]} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={skeletonStyles.card}>
            <View style={skeletonStyles.cardHeader}>
              <View style={skeletonStyles.iconPatch} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={[skeletonStyles.line, { width: "70%" }]} />
                <View style={[skeletonStyles.line, { width: "40%", height: 10 }]} />
              </View>
            </View>
            <View style={[skeletonStyles.line, { width: "100%", height: 44, borderRadius: radii.md }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  heroPatch: {
    height: 180,
    backgroundColor: colors.primary + "22",
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  line: {
    height: 14,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "33",
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  iconPatch: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
});

// ─── Picker choice helper ─────────────────────────────────────────────────────

/**
 * Shows a native action sheet (iOS) or Alert (Android) for Camera vs Gallery.
 * Returns "camera" | "gallery" | null (if cancelled).
 * Extracted so it stays clean and reusable.
 */
function showPickerChoice(
  acceptsPdf: boolean
): Promise<"camera" | "gallery" | null> {
  return new Promise((resolve) => {
    const options = ["Camera", acceptsPdf ? "Files / Gallery" : "Photo Library", "Cancel"];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
          title: "Upload Document",
          message: "Choose how to add your file",
        },
        (index) => {
          if (index === 0) resolve("camera");
          else if (index === 1) resolve("gallery");
          else resolve(null);
        }
      );
    } else {
      Alert.alert("Upload Document", "Choose how to add your file", [
        { text: "Camera",          onPress: () => resolve("camera")  },
        { text: options[1],        onPress: () => resolve("gallery") },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ]);
    }
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },

  // ── Hero band ──────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: colors.primary,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
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

  // Geometric decorations
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

  // ── White content card ─────────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    marginTop: -24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: spacing.md,
  },
  scroll: { paddingBottom: spacing.xl + 24 },

  // ── Security notice ────────────────────────────────────────────────────────
  securityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary + "08",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary + "22",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  securityText: {
    fontFamily: fonts.jostRegular, fontSize: 12,
    color: colors.primary, flex: 1,
  },

  // ── Remaining hint ─────────────────────────────────────────────────────────
  remainingHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  remainingHintText: {
    fontFamily: fonts.jostRegular, fontSize: 13,
    color: colors.textSecondary,
  },

  // ── Error state ────────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: spacing.lg, backgroundColor: colors.background,
  },
  errorIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.errorLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontFamily: fonts.jakartaSemiBold, fontSize: 18,
    color: colors.textPrimary, marginBottom: spacing.sm, textAlign: "center",
  },
  errorMessage: {
    fontFamily: fonts.jostRegular, fontSize: 14,
    color: colors.textSecondary, textAlign: "center",
    lineHeight: 22, marginBottom: spacing.lg, maxWidth: 300,
  },
  retryBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    minWidth: 140, alignItems: "center",
  },
  retryBtnText: {
    fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.white,
  },
});
