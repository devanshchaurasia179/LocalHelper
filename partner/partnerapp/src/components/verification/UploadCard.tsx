/**
 * UploadCard.tsx
 *
 * The single reusable card for every document in the verification flow.
 *
 * STRICT RULE: This component NEVER checks doc.key, doc.title, or any
 * document-specific string. It only reads the flags the backend provides:
 *   - doc.hasNumberField   → render a text input
 *   - doc.uploadStatus     → choose which UI variant to show
 *   - doc.action.type      → decide which CTA to render
 *   - doc.badge            → render the status chip
 *   - doc.rejectionReason  → show rejection detail
 *   - doc.previewUrl       → show image thumbnail
 *
 * When the backend adds a new document type tomorrow, this card renders it
 * automatically. No code changes needed here.
 *
 * Props:
 *   doc           — VerificationDocument from GET /partner/verification
 *   onUpload      — called when user picks a file; parent handles image picker
 *   isUploading   — true while this specific slot is uploading
 *   numberValue   — controlled value for the number input (if hasNumberField)
 *   onNumberChange — setter for the number input
 *   numberError   — validation error string for the number input
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { DocumentIcon } from "./DocumentIcon";
import { StatusBadge } from "./StatusBadge";
import type { VerificationDocument } from "@/types/verification";
import { colors, fonts, radii, spacing } from "@/constants/theme";

type Props = {
  doc: VerificationDocument;
  onUpload: (doc: VerificationDocument) => void;
  isUploading: boolean;
  /** Controlled number field value — only used when doc.hasNumberField is true */
  numberValue: string;
  onNumberChange: (value: string) => void;
  /** Validation error for the number field */
  numberError?: string | null;
};

export function UploadCard({
  doc,
  onUpload,
  isUploading,
  numberValue,
  onNumberChange,
  numberError,
}: Props) {
  const [showInstructions, setShowInstructions] = useState(false);

  const isApproved    = doc.uploadStatus === "approved";
  const isRejected    = doc.uploadStatus === "rejected";
  const isUnderReview = doc.uploadStatus === "under_review";
  const isMissing     = doc.uploadStatus === "missing";

  // ── Card border accent changes by status ──────────────────────────────
  const cardBorderColor = isApproved
    ? colors.successBorder
    : isRejected
    ? colors.errorBorder
    : isUnderReview
    ? "#FDE68A"
    : colors.navInactive + "44";

  const cardBg = isApproved
    ? colors.successLight
    : isRejected
    ? colors.errorLight
    : colors.background;

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(18)}
      entering={FadeIn.duration(280)}
      style={[styles.card, { borderColor: cardBorderColor, backgroundColor: cardBg }]}
    >
      {/* ── Header row: icon + title + badge ──────────────────────────── */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconWrap,
            isApproved && { backgroundColor: colors.successLight, borderColor: colors.successBorder },
            isRejected && { backgroundColor: colors.errorLight, borderColor: colors.errorBorder },
          ]}
        >
          <DocumentIcon
            name={doc.icon}
            size={22}
            color={
              isApproved ? colors.successDark
              : isRejected ? colors.errorDark
              : colors.primary
            }
          />
        </View>

        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {doc.title}
            </Text>
            {doc.versionLabel && (
              <View style={styles.versionChip}>
                <Text style={styles.versionText}>{doc.versionLabel}</Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <StatusBadge label={doc.badge.label} color={doc.badge.color} />
            <View
              style={[
                styles.requiredChip,
                !doc.isRequired && styles.optionalChip,
              ]}
            >
              <Text
                style={[
                  styles.requiredText,
                  !doc.isRequired && styles.optionalText,
                ]}
              >
                {doc.requiredLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Subtitle / description ─────────────────────────────────────── */}
      {doc.subtitle ? (
        <Text style={styles.subtitle}>{doc.subtitle}</Text>
      ) : null}

      {/* ── Preview image (when a file has been uploaded) ──────────────── */}
      {doc.previewUrl ? (
        <View style={styles.previewWrap}>
          <Image
            source={{ uri: doc.previewUrl }}
            style={styles.preview}
            resizeMode="cover"
            accessibilityLabel={`Preview of ${doc.title}`}
          />
          {isApproved && (
            <View style={styles.approvedOverlay}>
              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
              <Text style={styles.approvedOverlayText}>Approved</Text>
            </View>
          )}
          {isUnderReview && (
            <View style={styles.reviewOverlay}>
              <Ionicons name="time-outline" size={20} color="#92400E" />
              <Text style={styles.reviewOverlayText}>Under Review</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* ── Rejection reason (shown when status is rejected) ───────────── */}
      {isRejected && doc.rejectionReason ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.rejectionCard}
        >
          <View style={styles.rejectionHeader}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.errorDark}
            />
            <Text style={styles.rejectionLabel}>Rejection Reason</Text>
          </View>
          <Text style={styles.rejectionReason}>{doc.rejectionReason}</Text>
        </Animated.View>
      ) : null}

      {/* ── Number field (Aadhaar number, PAN number, etc.) ───────────── */}
      {/* Rendered only when doc.hasNumberField is true — no name checking */}
      {doc.hasNumberField && !isApproved ? (
        <View style={styles.numberFieldWrap}>
          <Text style={styles.numberFieldLabel}>
            {doc.numberFieldLabel ?? "Document Number"}
            <Text style={styles.requiredStar}> *</Text>
          </Text>
          <TextInput
            style={[
              styles.numberInput,
              numberError ? styles.numberInputError : null,
              (isUnderReview) && styles.numberInputDisabled,
            ]}
            placeholder={doc.numberFieldPlaceholder ?? "Enter number"}
            placeholderTextColor={colors.textSecondary}
            value={numberValue}
            onChangeText={onNumberChange}
            autoCapitalize="characters"
            editable={!isUnderReview && !isUploading}
            accessibilityLabel={doc.numberFieldLabel ?? "Document number"}
          />
          {numberError ? (
            <Text style={styles.fieldError}>{numberError}</Text>
          ) : null}
          {/* Pre-fill hint when re-uploading */}
          {doc.numberValue && !numberValue ? (
            <Text style={styles.prefillHint}>
              Previous: {doc.numberValue} — tap to edit
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Accepted file types + size info ───────────────────────────── */}
      {!isApproved && (
        <View style={styles.constraintsRow}>
          <View style={styles.constraintChip}>
            <Ionicons name="attach-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.constraintText}>{doc.acceptedTypesLabel}</Text>
          </View>
          <View style={styles.constraintChip}>
            <Ionicons name="scale-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.constraintText}>Max {doc.maxSizeMB} MB</Text>
          </View>
        </View>
      )}

      {/* ── Help text / instructions toggle ──────────────────────────── */}
      {doc.helpText ? (
        <View style={styles.helpSection}>
          <Pressable
            style={styles.helpToggle}
            onPress={() => setShowInstructions((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              showInstructions ? "Hide instructions" : "Show instructions"
            }
          >
            <Ionicons
              name={showInstructions ? "chevron-up" : "information-circle-outline"}
              size={15}
              color={colors.primary}
            />
            <Text style={styles.helpToggleText}>
              {showInstructions ? "Hide tips" : "How to upload"}
            </Text>
          </Pressable>

          {showInstructions ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={styles.helpContent}
            >
              <Text style={styles.helpText}>{doc.helpText}</Text>
              {doc.uploadInstructions ? (
                <Text style={styles.uploadInstructions}>
                  {doc.uploadInstructions}
                </Text>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {/* ── Sample image ─────────────────────────────────────────────── */}
      {doc.sampleImageUrl && !isApproved ? (
        <View style={styles.sampleWrap}>
          <Text style={styles.sampleLabel}>Sample</Text>
          <Image
            source={{ uri: doc.sampleImageUrl }}
            style={styles.sampleImage}
            resizeMode="contain"
            accessibilityLabel={`Sample image for ${doc.title}`}
          />
        </View>
      ) : null}

      {/* ── CTA button (action.type drives this — no status checks here) ── */}
      {doc.action.type !== "none" ? (
        <Pressable
          style={({ pressed }) => [
            styles.ctaBtn,
            isApproved && styles.ctaBtnView,
            isRejected && styles.ctaBtnReplace,
            (isUploading || isUnderReview) && styles.ctaBtnDisabled,
            pressed && !isUploading && styles.ctaBtnPressed,
          ]}
          onPress={() => onUpload(doc)}
          disabled={isUploading || isUnderReview || doc.action.type === "view"}
          accessibilityRole="button"
          accessibilityLabel={doc.action.label ?? doc.title}
        >
          {isUploading ? (
            <>
              <ActivityIndicator
                size="small"
                color={isApproved ? colors.success : colors.white}
              />
              <Text
                style={[
                  styles.ctaBtnText,
                  isApproved && styles.ctaBtnTextView,
                ]}
              >
                Uploading…
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name={
                  doc.action.type === "view"    ? "eye-outline"          :
                  doc.action.type === "replace" ? "refresh-outline"      :
                                                  "cloud-upload-outline"
                }
                size={18}
                color={isApproved ? colors.success : colors.white}
              />
              <Text
                style={[
                  styles.ctaBtnText,
                  isApproved && styles.ctaBtnTextView,
                ]}
              >
                {doc.action.label}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      {/* ── Under review lock message ─────────────────────────────────── */}
      {isUnderReview && !doc.previewUrl ? (
        <View style={styles.reviewNotice}>
          <Ionicons name="time-outline" size={15} color="#92400E" />
          <Text style={styles.reviewNoticeText}>Under review — locked</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    // Subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary + "10",
    borderWidth: 1,
    borderColor: colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    gap: 5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  versionChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  versionText: {
    fontFamily: fonts.jostMedium,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },

  // ── Required / Optional chips ─────────────────────────────────────────────
  requiredChip: {
    backgroundColor: colors.errorLight,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  requiredText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 10,
    color: colors.errorDark,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  optionalChip: {
    backgroundColor: colors.surface,
    borderColor: colors.navInactive + "66",
  },
  optionalText: {
    color: colors.textSecondary,
  },

  // ── Subtitle ──────────────────────────────────────────────────────────────
  subtitle: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // ── Preview image ─────────────────────────────────────────────────────────
  previewWrap: {
    borderRadius: radii.md,
    overflow: "hidden",
    height: 150,
    position: "relative",
    backgroundColor: colors.surfaceAlt,
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  approvedOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(16, 185, 129, 0.85)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
  },
  approvedOverlayText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 13,
    color: colors.white,
  },
  reviewOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(245, 158, 11, 0.85)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
  },
  reviewOverlayText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 13,
    color: "#451A03",
  },

  // ── Rejection card ────────────────────────────────────────────────────────
  rejectionCard: {
    backgroundColor: colors.errorLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    padding: spacing.sm + 2,
    gap: spacing.xs,
  },
  rejectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  rejectionLabel: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 12,
    color: colors.errorDark,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  rejectionReason: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.errorDark,
    lineHeight: 20,
  },

  // ── Number field ──────────────────────────────────────────────────────────
  numberFieldWrap: {
    gap: spacing.xs,
  },
  numberFieldLabel: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  requiredStar: {
    color: colors.error,
  },
  numberInput: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "66",
    letterSpacing: 1,
  },
  numberInputError: {
    borderColor: colors.error,
  },
  numberInputDisabled: {
    opacity: 0.5,
  },
  fieldError: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.error,
  },
  prefillHint: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: "italic",
  },

  // ── Constraints row ───────────────────────────────────────────────────────
  constraintsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  constraintChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  constraintText: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },

  // ── Help / instructions ───────────────────────────────────────────────────
  helpSection: {
    gap: spacing.xs,
  },
  helpToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  helpToggleText: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: colors.primary,
  },
  helpContent: {
    backgroundColor: colors.primary + "08",
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary + "44",
    padding: spacing.sm + 2,
    gap: spacing.xs,
  },
  helpText: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  uploadInstructions: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },

  // ── Sample image ──────────────────────────────────────────────────────────
  sampleWrap: {
    gap: spacing.xs,
  },
  sampleLabel: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sampleImage: {
    width: "100%",
    height: 100,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
  },

  // ── CTA button ────────────────────────────────────────────────────────────
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 4,
    minHeight: 46,
  },
  ctaBtnView: {
    backgroundColor: colors.successLight,
    borderWidth: 1.5,
    borderColor: colors.successBorder,
  },
  ctaBtnReplace: {
    backgroundColor: "#1C1C28", // darker for "replace" emphasis
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaBtnPressed: {
    opacity: 0.82,
  },
  ctaBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.white,
    letterSpacing: 0.2,
  },
  ctaBtnTextView: {
    color: colors.successDark,
  },

  // ── Under review notice ───────────────────────────────────────────────────
  reviewNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    justifyContent: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: radii.sm,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  reviewNoticeText: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: "#92400E",
  },
});
