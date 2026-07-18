import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";

import { useAuth } from "@/providers/AuthProvider";
import { VerificationGate } from "@/navigation/VerificationGate";
import { ROUTES } from "@/constants/routes";

/**
 * Root index — acts as a router gate.
 *
 * loading                                → spinner (session restore in progress)
 * unauthenticated                        → /(auth)/send-otp
 * authenticated, !isProfile              → /(onboarding)/complete-profile
 * authenticated, isProfile, !isService   → /(onboarding)/add-service
 * authenticated, isProfile, isService, !isDocument → /(onboarding)/upload-documents
 * authenticated, all steps done          → VerificationGate → status-based route
 */
export default function Index() {
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

  // ── Partner onboarding funnel ─────────────────────────────────────────────
  if (!partner.isProfile) {
    return <Redirect href={ROUTES.ONBOARDING.PROFILE as any} />;
  }
  if (!partner.isService) {
    return <Redirect href={ROUTES.ONBOARDING.SERVICE as any} />;
  }
  if (!partner.isDocument) {
    return <Redirect href={ROUTES.ONBOARDING.DOCUMENTS as any} />;
  }

  // Onboarding complete → central verification router decides next screen
  return <VerificationGate />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
