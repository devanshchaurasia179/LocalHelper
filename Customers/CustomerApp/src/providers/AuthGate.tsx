import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "./AuthProvider";

type Props = {
  /** Screen shown to fully onboarded customers */
  children: React.ReactNode;
  /** Route to redirect unauthenticated users to (default: /auth/login) */
  redirectTo?: string;
};

/**
 * AuthGate wraps any screen that requires authentication.
 *
 * Onboarding flow enforced here:
 *  1. No session          → /auth/login
 *  2. Phone verified but  isOnboarded = false → /onboarding/profile
 *  3. All steps done      → renders children (home)
 */
export function AuthGate({ children, redirectTo = "/auth/login" }: Props) {
  const { status, customer } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === "unauthenticated" || !customer) {
    return <Redirect href={redirectTo as any} />;
  }

  // ── Onboarding step redirect ───────────────────────────────────────────
  if (!customer.isOnboarded) {
    return <Redirect href="/onboarding/profile" />;
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
