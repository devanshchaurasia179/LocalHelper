import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";

import { useVerificationStatusRefresh } from "@/hooks/useVerificationStatusRefresh";
import { VERIFICATION_STATUS_LABELS } from "@/constants/verificationStatus";
import { ROUTES } from "@/constants/routes";
import { colors, fonts, radii, spacing } from "@/constants/theme";

const DEFAULT_REJECTION_MESSAGE =
  "Your documents could not be verified. Please upload clearer copies of your KYC documents.";

export default function RejectedScreen() {
  const router = useRouter();
  const {
    profile,
    status,
    isLoading,
    isRefreshing,
    isError,
    error,
    refresh,
  } = useVerificationStatusRefresh({ screen: "rejected" });

  const rejectionReason =
    profile?.verification.rejectionReason?.trim() || DEFAULT_REJECTION_MESSAGE;

  const handleUploadAgain = () => {
    router.replace(ROUTES.ONBOARDING.DOCUMENTS as any);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <RejectedSkeleton />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.error} />
          </View>
          <Text style={styles.errorTitle}>Unable to Load Details</Text>
          <Text style={styles.errorMessage}>{getErrorMessage(error)}</Text>
          <Pressable
            style={[styles.retryBtn, isRefreshing && styles.btnDisabled]}
            onPress={refresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.retryBtnText}>Try Again</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.illustrationWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="close-circle" size={56} color={colors.error} />
          </View>
          <View style={styles.alertBadge}>
            <Ionicons name="alert" size={16} color={colors.white} />
          </View>
        </View>

        <Text style={styles.title}>Verification Rejected</Text>

        {status && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {VERIFICATION_STATUS_LABELS[status]}
            </Text>
          </View>
        )}

        <Text style={styles.subtitle}>
          We couldn't verify your documents. Please review the reason below and
          upload again.
        </Text>

        <View style={styles.reasonCard}>
          <View style={styles.reasonHeader}>
            <Ionicons name="document-text-outline" size={22} color={colors.errorDark} />
            <Text style={styles.reasonLabel}>Rejection Reason</Text>
          </View>
          <Text style={styles.reasonText}>{rejectionReason}</Text>
        </View>

        <View style={styles.tipCard}>
          <Ionicons
            name="bulb-outline"
            size={20}
            color={colors.textSecondary}
            style={styles.tipIcon}
          />
          <Text style={styles.tipText}>
            Make sure photos are well-lit, in focus, and all corners of the
            document are visible before re-uploading.
          </Text>
        </View>

        <Pressable
          style={styles.uploadBtn}
          onPress={handleUploadAgain}
          accessibilityRole="button"
          accessibilityLabel="Upload documents again"
        >
          <Ionicons name="cloud-upload-outline" size={22} color={colors.white} />
          <Text style={styles.uploadBtnText}>Upload Again</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function RejectedSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonCircle} />
      <View style={[styles.skeletonLine, { width: "65%" }]} />
      <View style={[styles.skeletonLine, { width: "85%" }]} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonBtn} />
    </View>
  );
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && (!error.response || error.code === "ERR_NETWORK")) {
    return "Network error. Check your connection and try again.";
  }
  return "Something went wrong while loading your verification details.";
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl + 16,
    alignItems: "center",
  },

  illustrationWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.errorBorder,
  },
  alertBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.errorDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
  },

  title: {
    fontFamily: fonts.oswaldBold,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  statusBadge: {
    backgroundColor: colors.errorLight,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  statusBadgeText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 12,
    color: colors.errorDark,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  subtitle: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.lg,
    maxWidth: 340,
  },

  reasonCard: {
    width: "100%",
    backgroundColor: colors.errorLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  reasonLabel: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.errorDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reasonText: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.errorDark,
    lineHeight: 24,
  },

  tipCard: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    alignItems: "flex-start",
  },
  tipIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    minHeight: 52,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.3,
  },

  btnDisabled: {
    opacity: 0.85,
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  errorIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  errorMessage: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
    maxWidth: 300,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 140,
    alignItems: "center",
  },
  retryBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
  },

  skeletonWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: "center",
  },
  skeletonCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.lg,
  },
  skeletonLine: {
    height: 14,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  skeletonCard: {
    width: "100%",
    height: 100,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  skeletonBtn: {
    width: "100%",
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
});
