import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";

import { useAuth } from "@/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";

/**
 * Root index — acts as a router gate.
 *
 * loading             → spinner (session restore in progress)
 * unauthenticated     → /(auth)/send-otp
 * authenticated, not onboarded → /(onboarding)
 * authenticated, onboarded     → /(tabs)/home
 */
export default function Index() {
  const { status, customer } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === "unauthenticated") {
    return <Redirect href={ROUTES.AUTH.SEND_OTP as any} />;
  }

  // authenticated — not yet onboarded
  if (!customer?.isOnboarded) {
    return <Redirect href={ROUTES.ONBOARDING.PROFILE as any} />;
  }

  // authenticated + onboarded
  return <Redirect href={ROUTES.APP.HOME as any} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
