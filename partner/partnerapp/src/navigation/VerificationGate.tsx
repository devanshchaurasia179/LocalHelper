import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import axios from "axios";

import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import { useAuth } from "@/providers/AuthProvider";
import { VERIFICATION_STATUS } from "@/constants/verificationStatus";
import { ACCOUNT_STATUS } from "@/constants/accountStatus";
import { ROUTES } from "@/constants/routes";
import { colors, fonts, radii, spacing } from "@/constants/theme";

/**
 * Central verification router — the only place that reads verification.status
 * and decides which screen the partner should see after onboarding.
 *
 * Flow (after auth + onboarding):
 *   NOT_SUBMITTED → KYC upload
 *   UNDER_REVIEW  → waiting screen
 *   REJECTED      → rejection screen
 *   VERIFIED      → partner home
 */
export function VerificationGate() {
  const { signOut, partner } = useAuth();
  const { data, isLoading, isError, error, refetch, isRefetching } =
    usePartnerStatus();

  const isUnauthorized =
    isError && axios.isAxiosError(error) && error.response?.status === 401;

  // Check if the error is a 403 with accountStatus (blocked/suspended)
  const accountStatusFromError =
    isError &&
    axios.isAxiosError(error) &&
    error.response?.status === 403 &&
    error.response?.data?.accountStatus
      ? (error.response.data.accountStatus as string)
      : null;

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

  // ── Handle 403 account status from middleware ─────────────────────────────
  if (accountStatusFromError === ACCOUNT_STATUS.BLOCKED) {
    return <Redirect href={ROUTES.ACCOUNT_STATUS.BLOCKED as any} />;
  }
  if (accountStatusFromError === ACCOUNT_STATUS.SUSPENDED) {
    return <Redirect href={ROUTES.ACCOUNT_STATUS.SUSPENDED as any} />;
  }

  // ── Check partner object from AuthContext (set during login/session restore)
  if (partner?.accountStatus === "Blocked") {
    return <Redirect href={ROUTES.ACCOUNT_STATUS.BLOCKED as any} />;
  }
  if (partner?.accountStatus === "Suspended") {
    return <Redirect href={ROUTES.ACCOUNT_STATUS.SUSPENDED as any} />;
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

  // ── Account status check — blocked/suspended takes precedence ────────────
  if (data.accountStatus === ACCOUNT_STATUS.SUSPENDED) {
    return <Redirect href={ROUTES.ACCOUNT_STATUS.SUSPENDED as any} />;
  }
  if (data.accountStatus === ACCOUNT_STATUS.BLOCKED) {
    return <Redirect href={ROUTES.ACCOUNT_STATUS.BLOCKED as any} />;
  }

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
