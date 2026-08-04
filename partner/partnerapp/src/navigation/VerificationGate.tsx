import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import axios from "axios";

import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import { useAuth } from "@/providers/AuthProvider";
import { VERIFICATION_STATUS } from "@/constants/verificationStatus";
import { ACCOUNT_STATUS } from "@/constants/accountStatus";
import { ROUTES } from "@/constants/routes";
import { colors, fonts, radii, spacing } from "@/constants/theme";

// ─── Inline Suspended UI ──────────────────────────────────────────────────────

function SuspendedView({
  reason,
  onSignOut,
}: {
  reason: string;
  onSignOut: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconCircleWarning}>
          <Ionicons name="pause-circle" size={56} color="#F59E0B" />
        </View>
        <Text style={styles.title}>Account Suspended</Text>
        <View style={[styles.statusBadge, styles.statusBadgeWarning]}>
          <Text style={[styles.statusBadgeText, styles.statusBadgeTextWarning]}>
            Temporarily Suspended
          </Text>
        </View>
        <Text style={styles.subtitle}>
          Your account access has been temporarily restricted. You cannot accept
          new bookings or access partner features until the suspension is lifted.
        </Text>
        <View style={[styles.reasonCard, styles.reasonCardWarning]}>
          <View style={styles.reasonHeader}>
            <Ionicons name="information-circle-outline" size={22} color="#92400E" />
            <Text style={[styles.reasonLabel, { color: "#92400E" }]}>Reason</Text>
          </View>
          <Text style={[styles.reasonText, { color: "#92400E" }]}>{reason}</Text>
        </View>
        <Pressable
          style={styles.contactBtn}
          onPress={() => Linking.openURL("mailto:support@localhelpers.in")}
          accessibilityRole="button"
        >
          <Ionicons name="mail-outline" size={22} color={colors.white} />
          <Text style={styles.contactBtnText}>Contact Support</Text>
        </Pressable>
        <Pressable style={styles.signOutBtn} onPress={onSignOut} accessibilityRole="button">
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Inline Blocked UI ────────────────────────────────────────────────────────

function BlockedView({
  reason,
  onSignOut,
}: {
  reason: string;
  onSignOut: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconCircleError}>
          <Ionicons name="ban" size={56} color={colors.error} />
        </View>
        <Text style={styles.title}>Account Blocked</Text>
        <View style={[styles.statusBadge, styles.statusBadgeError]}>
          <Text style={[styles.statusBadgeText, styles.statusBadgeTextError]}>
            Permanently Blocked
          </Text>
        </View>
        <Text style={styles.subtitle}>
          Your account has been blocked and you can no longer access partner
          features. Please contact support if you believe this is a mistake.
        </Text>
        <View style={[styles.reasonCard, styles.reasonCardError]}>
          <View style={styles.reasonHeader}>
            <Ionicons name="information-circle-outline" size={22} color={colors.error} />
            <Text style={[styles.reasonLabel, { color: colors.error }]}>Reason</Text>
          </View>
          <Text style={[styles.reasonText, { color: colors.error }]}>{reason}</Text>
        </View>
        <Pressable
          style={styles.contactBtn}
          onPress={() => Linking.openURL("mailto:support@localhelpers.in")}
          accessibilityRole="button"
        >
          <Ionicons name="mail-outline" size={22} color={colors.white} />
          <Text style={styles.contactBtnText}>Contact Support</Text>
        </Pressable>
        <Pressable style={styles.signOutBtn} onPress={onSignOut} accessibilityRole="button">
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── VerificationGate ─────────────────────────────────────────────────────────

/**
 * Central verification router — the only place that reads verification.status
 * and decides which screen the partner should see after onboarding.
 *
 * Flow (after auth + onboarding):
 *   Blocked/Suspended → inline account-status screen (no route change)
 *   NOT_SUBMITTED     → KYC upload
 *   UNDER_REVIEW      → waiting screen
 *   REJECTED          → rejection screen
 *   VERIFIED          → partner home
 */
export function VerificationGate() {
  const { signOut, partner } = useAuth();
  const { data, isLoading, isError, error, refetch, isRefetching } =
    usePartnerStatus();

  const isUnauthorized =
    isError && axios.isAxiosError(error) && error.response?.status === 401;

  useEffect(() => {
    if (isUnauthorized) {
      signOut();
    }
  }, [isUnauthorized, signOut]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isUnauthorized) {
    return <Redirect href={ROUTES.AUTH.SEND_OTP as any} />;
  }

  if (isError || !data) {
    const isNetworkError =
      axios.isAxiosError(error) &&
      (!error.response || error.code === "ERR_NETWORK");

    const message = isNetworkError
      ? "Network error. Check your connection and try again."
      : axios.isAxiosError(error) && error.response?.status
        ? "Server error. Please try again in a moment."
        : "Something went wrong while checking your verification status.";

    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Unable to Load Status</Text>
        <Text style={styles.errorMessage}>{message}</Text>
        <Pressable
          style={[styles.retryBtn, isRefetching && styles.retryBtnDisabled]}
          onPress={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.retryText}>Try Again</Text>
          )}
        </Pressable>
      </View>
    );
  }

  // ── Account status: render inline, no route navigation ───────────────────
  const accountStatus = data.accountStatus ?? partner?.accountStatus;
  const statusReason  = data.statusReason  ?? partner?.statusReason ?? "";

  if (accountStatus === ACCOUNT_STATUS.SUSPENDED) {
    return (
      <SuspendedView
        reason={statusReason || "Your account has been temporarily suspended by the admin."}
        onSignOut={signOut}
      />
    );
  }

  if (accountStatus === ACCOUNT_STATUS.BLOCKED) {
    return (
      <BlockedView
        reason={statusReason || "Your account has been permanently blocked due to policy violations."}
        onSignOut={signOut}
      />
    );
  }

  // ── Verification routing ──────────────────────────────────────────────────
  switch (data.verification.status) {
    case VERIFICATION_STATUS.NOT_SUBMITTED:
      return <Redirect href={ROUTES.ONBOARDING.DOCUMENTS as any} />;
    case VERIFICATION_STATUS.UNDER_REVIEW:
      return <Redirect href={ROUTES.VERIFICATION.UNDER_REVIEW as any} />;
    case VERIFICATION_STATUS.REJECTED:
      return <Redirect href={ROUTES.VERIFICATION.REJECTED as any} />;
    case VERIFICATION_STATUS.VERIFIED:
      return <Redirect href={ROUTES.APP.HOME as any} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  safeArea: {
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
  iconCircleWarning: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FDE68A",
    marginBottom: spacing.lg,
  },
  iconCircleError: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.error,
    marginBottom: spacing.lg,
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
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  statusBadgeWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  statusBadgeError: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  statusBadgeText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statusBadgeTextWarning: {
    color: "#92400E",
  },
  statusBadgeTextError: {
    color: colors.error,
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
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  reasonCardWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  reasonCardError: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
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
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reasonText: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    lineHeight: 24,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    minHeight: 52,
    marginBottom: spacing.md,
  },
  contactBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.3,
  },
  signOutBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  signOutBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
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
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 140,
    alignItems: "center",
  },
  retryBtnDisabled: {
    opacity: 0.7,
  },
  retryText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});
