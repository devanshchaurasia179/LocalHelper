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
// Maximum photos that can be picked at once for a single document slot
const MAX_MULTI_PHOTOS = 5;
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useVerification } from "@/hooks/useVerification";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { useSubmitVerification } from "@/hooks/useSubmitVerification";
import { useDeleteDocumentPhoto } from "@/hooks/useDeleteDocumentPhoto";
import { UploadCard } from "@/components/verification/UploadCard";
import { ROUTES } from "@/constants/routes";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import type { VerificationDocument } from "@/types/verification";

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function UploadDocumentsScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useVerification();
  const { upload, isUploading } = useDocumentUpload();
  const { submit, isSubmitting } = useSubmitVerification();
  const { deletePhoto, isDeleting } = useDeleteDocumentPhoto();

  /**
   * numberValues: keyed by documentTypeId — one entry per card that has
   * hasNumberField === true. Independent state per card.
   * Format: { [documentTypeId]: string }
   */
  const [numberValues, setNumberValues] = useState<Record<string, string>>({});
  const [numberErrors, setNumberErrors] = useState<Record<string, string | null>>({});

  /**
   * pendingUris: local URIs for multi-photo uploads, keyed by "docTypeId_side".
   * Shown as a thumbnail strip on the card while uploading.
   * Cleared once the upload sequence completes or fails.
   */
  const [pendingUris, setPendingUris] = useState<Record<string, string[]>>({});
  /**
   * uploadingPhotoIndex: which photo in the array is currently being uploaded.
   * Keyed by "docTypeId_side". Drives the per-thumb progress indicator.
   */
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState<Record<string, number>>({});

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
   * choose between camera and gallery.
   *
   * Returns an array of { uri, mimeType } objects (one or more photos),
   * or null if the user cancelled.
   *
   * Camera always returns a single photo.
   * Gallery allows multi-select (up to MAX_MULTI_PHOTOS), unless the doc
   * accepts PDFs — PDFs are always single-file and can't be multi-selected.
   */
  const pickFile = useCallback(
    async (
      doc: VerificationDocument
    ): Promise<Array<{ uri: string; mimeType: string; fileSize?: number }> | null> => {
      // ── Check whether PDF is accepted for this document ─────────────────
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
        return [{
          uri: result.assets[0].uri,
          mimeType: result.assets[0].mimeType ?? "image/jpeg",
          fileSize: result.assets[0].fileSize,
        }];
      }

      // ── Gallery ──────────────────────────────────────────────────────────
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Photo Library",
          "Allow photo library access in Settings to upload documents."
        );
        return null;
      }

      // PDFs: single-select only (allowsEditing not supported for PDF)
      // Images: multi-select up to MAX_MULTI_PHOTOS
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: acceptsPdf
          ? ImagePicker.MediaTypeOptions.All
          : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,           // must be false to enable multi-select
        allowsMultipleSelection: !acceptsPdf,
        selectionLimit: acceptsPdf ? 1 : MAX_MULTI_PHOTOS,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return null;

      return result.assets.map((asset) => ({
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
        fileSize: asset.fileSize,
      }));
    },
    []
  );

  // ── Handle upload for any document card ────────────────────────────────
  /**
   * Called by UploadCard's onUpload prop.
   * Handles every document type through the same generic pipeline.
   *
   * For multi-photo: iterates through each picked file and calls upload()
   * sequentially. Each upload patches the cache independently.
   * The last successful response determines the final session status check.
   */
  const handleUpload = useCallback(
    async (doc: VerificationDocument) => {
      const slotKey = `${doc.documentTypeId}_${doc.side}`;

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
      }

      // ── 2. Pick file(s) ───────────────────────────────────────────────────
      const files = await pickFile(doc);
      if (!files || files.length === 0) return; // user cancelled

      // ── 2a. Validate file sizes (max 5 MB per file to match backend) ──────
      const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB to match backend limit
      const oversizedCount = files.filter(
        (f) => f.fileSize !== undefined && f.fileSize > MAX_FILE_SIZE_BYTES
      ).length;

      if (oversizedCount > 0) {
        Alert.alert(
          "File Too Large",
          oversizedCount === 1
            ? "The selected file exceeds the 5 MB limit. Please choose a smaller file."
            : `${oversizedCount} selected files exceed the 5 MB limit. Please choose smaller files.`
        );
        return;
      }

      // ── 3. Show pending strip immediately after selection ─────────────────
      setPendingUris((prev) => ({ ...prev, [slotKey]: files.map((f) => f.uri) }));
      setUploadingPhotoIndex((prev) => ({ ...prev, [slotKey]: 0 }));

      // ── 4. Upload each file sequentially ─────────────────────────────────
      let lastSessionStatus: string | null = null;
      let anyFailed = false;

      for (let i = 0; i < files.length; i++) {
        setUploadingPhotoIndex((prev) => ({ ...prev, [slotKey]: i }));

        const file = files[i];
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
          lastSessionStatus = result.sessionStatus;
          if (files.length > 1) {
            Toast.show({
              type: "success",
              text1: `Photo ${i + 1} of ${files.length} uploaded`,
              text2: doc.title,
              visibilityTime: 1800,
            });
          }
        } else {
          anyFailed = true;
          Toast.show({
            type: "error",
            text1: files.length > 1
              ? `Photo ${i + 1} of ${files.length} failed`
              : "Upload failed",
            text2: result.message,
            visibilityTime: 3500,
          });
          break;
        }
      }

      // ── 5. Clear pending strip ────────────────────────────────────────────
      setPendingUris((prev) => {
        const next = { ...prev };
        delete next[slotKey];
        return next;
      });
      setUploadingPhotoIndex((prev) => {
        const next = { ...prev };
        delete next[slotKey];
        return next;
      });

      // ── 6. Final success toast ─────────────────────────────────────────────
      if (!anyFailed) {
        Toast.show({
          type: "success",
          text1: files.length > 1
            ? `${files.length} photos uploaded`
            : "Uploaded successfully",
          text2: doc.title,
          visibilityTime: 2500,
        });
        // No auto-navigate here — partner submits explicitly via the Submit button
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upload, pickFile, numberValues]
  );

  // ── Handle photo deletion from a Pending draft slot ─────────────────────
  const handleDeletePhoto = useCallback(
    async (doc: VerificationDocument, photoIndex: number) => {
      const result = await deletePhoto(doc.documentTypeId, doc.side, photoIndex);
      if (!result.ok) {
        Toast.show({
          type: "error",
          text1: "Remove failed",
          text2: result.message,
          visibilityTime: 3000,
        });
      }
    },
    [deletePhoto]
  );

  // ── Handle explicit submit for review ────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const result = await submit();
    if (result.ok) {
      Toast.show({
        type: "success",
        text1: "Submitted for review",
        text2: "We'll notify you within 24–48 hours.",
        visibilityTime: 3000,
      });
      router.replace(ROUTES.VERIFICATION.UNDER_REVIEW as any);
    } else {
      if (result.missingDocuments?.length) {
        Alert.alert(
          "Missing Documents",
          `Please upload the following before submitting:\n\n• ${result.missingDocuments.join("\n• ")}`
        );
      } else {
        Toast.show({
          type: "error",
          text1: "Submission failed",
          text2: result.message,
          visibilityTime: 3500,
        });
      }
    }
  }, [submit]);

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

  // Ready to submit when all required slots have at least one photo (pending)
  // and the session hasn't already been submitted (Under Review).
  const canSubmit = missingRequired === 0 && data.sessionStatus !== "Under Review";
  const alreadyUnderReview = data.sessionStatus === "Under Review";

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
        {/* Back button */}
        <Pressable
          style={styles.heroBackBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace(ROUTES.ONBOARDING.SERVICE as any);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
        </Pressable>
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
              onDeletePhoto={handleDeletePhoto}
              isUploading={isUploading(doc.documentTypeId, doc.side)}
              isDeletingPhotoIndex={
                // pass the index being deleted if it's for this specific slot
                (() => {
                  // find which index is being deleted for this slot by probing each
                  for (let i = 0; i < (doc.previewUrls?.length ?? 0); i++) {
                    if (isDeleting(doc.documentTypeId, doc.side, i)) return i;
                  }
                  return null;
                })()
              }
              numberValue={getNumberValue(doc)}
              onNumberChange={(v) => setNumberValue(doc.documentTypeId, v)}
              numberError={numberErrors[doc.documentTypeId]}
              pendingUris={pendingUris[`${doc.documentTypeId}_${doc.side}`]}
              uploadingIndex={uploadingPhotoIndex[`${doc.documentTypeId}_${doc.side}`]}
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

          {/* ── Submit for Review button ──────────────────────────────── */}
          {!alreadyUnderReview && actionableDocuments.length > 0 && (
            <Animated.View entering={FadeIn} style={styles.submitWrap}>
              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  !canSubmit && styles.submitBtnDisabled,
                  pressed && canSubmit && { opacity: 0.85 },
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Submit documents for review"
                accessibilityState={{ disabled: !canSubmit || isSubmitting }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={canSubmit ? colors.white : colors.textSecondary}
                    />
                    <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
                      Submit for Review
                    </Text>
                  </>
                )}
              </Pressable>
              {!canSubmit && missingRequired > 0 && (
                <Text style={styles.submitHint}>
                  Upload {missingRequired} more required document{missingRequired > 1 ? "s" : ""} to submit
                </Text>
              )}
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
      <Ionicons name={c.icon} size={18} color={c.titleColor} style={{ marginTop: 0 }} />
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
    gap: spacing.xs + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
  },
  content: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.jakartaSemiBold, fontSize: 13, lineHeight: 17 },
  message: { fontFamily: fonts.jostRegular, fontSize: 12, lineHeight: 17 },
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
  wrap: { marginBottom: spacing.sm + 2, gap: spacing.xs - 2 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: fonts.jostMedium, fontSize: 11, color: colors.textSecondary },
  count:  { fontFamily: fonts.jakartaSemiBold, fontSize: 11, color: colors.primary },
  track: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2.5,
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
    const galleryLabel = acceptsPdf ? "Files / Gallery" : "Photo Library (multi-select)";
    const options = ["Camera", galleryLabel, "Cancel"];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
          title: "Upload Document",
          message: acceptsPdf
            ? "Choose how to add your file"
            : "Choose how to add your photo(s)",
        },
        (index) => {
          if (index === 0) resolve("camera");
          else if (index === 1) resolve("gallery");
          else resolve(null);
        }
      );
    } else {
      Alert.alert(
        "Upload Document",
        acceptsPdf ? "Choose how to add your file" : "Choose how to add your photo(s)",
        [
          { text: "Camera",          onPress: () => resolve("camera")  },
          { text: galleryLabel,      onPress: () => resolve("gallery") },
          { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        ]
      );
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
  heroBackBtn: {
    position: "absolute",
    top: 44,
    left: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
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
    paddingHorizontal: spacing.md + 2,
    paddingTop: spacing.xs + 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 36, height: 3.5, borderRadius: 2,
    backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: spacing.sm + 2,
  },
  scroll: { paddingBottom: spacing.lg + 20 },

  // ── Security notice ────────────────────────────────────────────────────────
  securityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs - 2,
    backgroundColor: colors.primary + "08",
    borderRadius: radii.sm - 2,
    borderWidth: 0.5,
    borderColor: colors.primary + "22",
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs + 2,
  },
  securityText: {
    fontFamily: fonts.jostRegular, fontSize: 11,
    color: colors.primary, flex: 1,
  },

  // ── Remaining hint ─────────────────────────────────────────────────────────
  remainingHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs - 2,
    justifyContent: "center",
    marginTop: spacing.xs + 4,
  },
  remainingHintText: {
    fontFamily: fonts.jostRegular, fontSize: 12,
    color: colors.textSecondary,
  },

  // ── Submit for Review button ───────────────────────────────────────────────
  submitWrap: {
    marginTop: spacing.md + 2,
    gap: spacing.xs + 2,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm + 2,
    paddingVertical: spacing.sm + 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs + 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.32,
    shadowRadius: 7,
    elevation: 5,
  },
  submitBtnDisabled: {
    backgroundColor: colors.surfaceAlt,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.15,
  },
  submitBtnTextDisabled: {
    color: colors.textSecondary,
  },
  submitHint: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
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
