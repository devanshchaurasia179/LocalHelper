import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "./AuthProvider";
import { VerificationGate } from "@/navigation/VerificationGate";
import { NoInternetScreen } from "@/screens/NoInternetScreen";
import { ROUTES } from "@/constants/routes";

type Props = {
  /** Reserved for wrapping verified-only content in future tab layouts */
  children?: React.ReactNode;
};

/**
 * AuthGate wraps any screen that requires authentication.
 *
 * Partner onboarding funnel enforced here:
 *  1. No connection                → NoInternetScreen (retry restores session)
 *  2. No session                   → /(auth)/send-otp
 *  3. Account blocked/suspended    → account status screens
 *  4. Phone verified, !isProfile   → /(onboarding)/complete-profile
 *  5. isProfile, !isService        → /(onboarding)/add-service
 *  6. isService, !isDocument       → /(onboarding)/upload-documents
 *  7. All steps done               → VerificationGate → status-based route
 */
export function AuthGate({ children: _children }: Props) {
  const { status, partner, retryConnection } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ── No internet — show retry screen instead of kicking to login ───────────
  if (status === "no_internet") {
    return <NoInternetScreen onRetry={retryConnection} />;
  }

  if (status === "unauthenticated" || !partner) {
    return <Redirect href={ROUTES.AUTH.SEND_OTP as any} />;
  }

  // ── Account status takes precedence over onboarding ───────────────────────
  if (partner.accountStatus === "Blocked") {
    return <Redirect href={ROUTES.ACCOUNT_STATUS.BLOCKED as any} />;
  }
  if (partner.accountStatus === "Suspended") {
    return <Redirect href={ROUTES.ACCOUNT_STATUS.SUSPENDED as any} />;
  }

  // ── Partner onboarding step redirects ─────────────────────────────────────
  if (!partner.isProfile) {
    return <Redirect href={ROUTES.ONBOARDING.PROFILE as any} />;
  }
  if (!partner.isService) {
    return <Redirect href={ROUTES.ONBOARDING.SERVICE as any} />;
  }
  if (!partner.isDocument) {
    return <Redirect href={ROUTES.ONBOARDING.DOCUMENTS as any} />;
  }

  // All steps complete → verification gate decides access to protected screens
  return <VerificationGate />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
