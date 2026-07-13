import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "./AuthProvider";

type Props = {
  /** Screen shown to fully onboarded partners */
  children: React.ReactNode;
  /** Route to redirect unauthenticated users to (default: /auth/login) */
  redirectTo?: string;
};

/**
 * AuthGate wraps any screen that requires authentication.
 *
 * Onboarding flow enforced here:
 *  1. No session          → /auth/login
 *  2. Phone verified but  isProfile  = false → /onboarding/profile
 *  3. isProfile but       isService  = false → /onboarding/service
 *  4. isService but       isDocument = false → /onboarding/documents
 *  5. All steps done      → renders children (home)
 */
export function AuthGate({ children, redirectTo = "/auth/login" }: Props) {
  const { status, partner } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === "unauthenticated" || !partner) {
    return <Redirect href={redirectTo as any} />;
  }

  // ── Onboarding step redirects ──────────────────────────────────────────
  if (!partner.isProfile) {
    return <Redirect href="/onboarding/profile" />;
  }

  if (!partner.isService) {
    return <Redirect href="/onboarding/service" />;
  }

  if (!partner.isDocument) {
    return <Redirect href="/onboarding/documents" />;
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
