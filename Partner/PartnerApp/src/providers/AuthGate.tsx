import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "./AuthProvider";
import { ROUTES } from "@/constants/routes";

type Props = {
  /** Screen shown to fully onboarded partners */
  children: React.ReactNode;
};

/**
 * AuthGate wraps any screen that requires authentication.
 *
 * Partner onboarding funnel enforced here:
 *  1. No session                  → /(auth)/send-otp
 *  2. Phone verified, !isProfile  → /(onboarding)/complete-profile
 *  3. isProfile, !isService       → /(onboarding)/add-service
 *  4. isService, !isDocument      → /(onboarding)/upload-documents
 *  5. All steps done              → renders children (home)
 */
export function AuthGate({ children }: Props) {
  const { status, partner } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === "unauthenticated" || !partner) {
    return <Redirect href={ROUTES.AUTH.SEND_OTP as any} />;
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

  // All steps complete → show the protected screen
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
