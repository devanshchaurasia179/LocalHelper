import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { VerificationGate } from "@/navigation/VerificationGate";
import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import { VERIFICATION_STATUS } from "@/constants/verificationStatus";
import { colors } from "@/constants/theme";

/**
 * Wraps verified-only routes (e.g. tabs). Unverified partners are
 * redirected through VerificationGate — never see home directly.
 */
export function VerifiedGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = usePartnerStatus();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (data?.verification.status !== VERIFICATION_STATUS.VERIFIED) {
    return <VerificationGate />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
