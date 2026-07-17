import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";

import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, radii } from "@/constants/theme";
import { ROUTES } from "@/constants/routes";

export default function SendOtpScreen() {
  // ── Hooks — always called first ───────────────────────────────────────────
  const { requestOtp, status } = useAuth();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Redirect after hooks ──────────────────────────────────────────────────
  if (status === "authenticated") {
    return <Redirect href={ROUTES.APP.HOME as any} />;
  }

  // ── Derived state & handlers ──────────────────────────────────────────────
  const isValid = /^\d{10}$/.test(phone);

  const handleSend = async () => {
    if (!isValid || loading) return;
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      router.push({
        pathname: ROUTES.AUTH.VERIFY_OTP as any,
        params: { phone },
      });
    } catch (e: any) {
      setError(
        e?.response?.data?.message ?? "Failed to send OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* ── Hero band ───────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Decorative triangles */}
          <View style={styles.triTopRight} pointerEvents="none" />
          <View style={styles.triTopRightInner} pointerEvents="none" />
          <View style={styles.triBottomLeft} pointerEvents="none" />
          <View style={styles.triMidRight} pointerEvents="none" />
          <View style={styles.triMidLeft} pointerEvents="none" />
          <View style={styles.triBottomRight} pointerEvents="none" />

          <Text style={styles.appName}>LocalHelpers</Text>
          <Text style={styles.heroTitle}>
            Earn on Your{"\n"}Own Schedule.
          </Text>
          <Text style={styles.heroSub}>
            Join as a service partner and start earning today
          </Text>
        </View>

        {/* ── White content card overlapping hero ─────────────────────── */}
        <View style={styles.card}>
          {/* drag handle */}
          <View style={styles.handle} />

          <Text style={styles.cardTitle}>Partner Sign in / Sign up</Text>
          <Text style={styles.cardSubtitle}>
            We'll send a one-time password to verify your number
          </Text>

          {/* Phone input */}
          <View
            style={[
              styles.inputRow,
              error ? styles.inputRowError : null,
            ]}
          >
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>🇮🇳  +91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor="#797979ff"
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              onChangeText={(t) => {
                setError(null);
                setPhone(t.replace(/\D/g, ""));
              }}
              returnKeyType="done"
              onSubmitEditing={handleSend}
              accessibilityLabel="Mobile number"
            />
            {phone.length > 0 && (
              <Text style={styles.charCount}>{phone.length}/10</Text>
            )}
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorDot}>●</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              (!isValid || loading) && styles.buttonDisabled,
              pressed && isValid && !loading && styles.buttonPressed,
            ]}
            onPress={handleSend}
            disabled={!isValid || loading}
            accessibilityRole="button"
            accessibilityLabel="Send OTP"
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </Pressable>

          <Text style={styles.disclaimer}>
            By continuing, you agree to our{" "}
            <Text style={styles.disclaimerLink}>Terms of Service</Text> and{" "}
            <Text style={styles.disclaimerLink}>Privacy Policy</Text>.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingTop: 64,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 24,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  appName: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.white,
    lineHeight: 38,
    letterSpacing: 0.1,
  },
  heroSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  // Decorative triangles
  triTopRight: {
    position: "absolute", top: -30, right: -30, width: 0, height: 0,
    borderStyle: "solid", borderLeftWidth: 140, borderBottomWidth: 140,
    borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.07)",
  },
  triTopRightInner: {
    position: "absolute", top: 10, right: 10, width: 0, height: 0,
    borderStyle: "solid", borderLeftWidth: 90, borderBottomWidth: 90,
    borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.05)",
  },
  triBottomLeft: {
    position: "absolute", bottom: 28, left: -20, width: 0, height: 0,
    borderStyle: "solid", borderRightWidth: 110, borderTopWidth: 110,
    borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)",
  },
  triMidRight: {
    position: "absolute", top: "42%", right: 30, width: 0, height: 0,
    borderStyle: "solid", borderLeftWidth: 50, borderBottomWidth: 50,
    borderLeftColor: "transparent", borderBottomColor: "rgba(255,255,255,0.08)",
    transform: [{ rotate: "20deg" }],
  },
  triMidLeft: {
    position: "absolute", top: "30%", left: 20, width: 0, height: 0,
    borderStyle: "solid", borderRightWidth: 36, borderTopWidth: 36,
    borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.05)",
    transform: [{ rotate: "-15deg" }],
  },
  triBottomRight: {
    position: "absolute", bottom: -30, right: -30, width: 0, height: 0,
    borderStyle: "solid", borderLeftWidth: 130, borderTopWidth: 130,
    borderLeftColor: "transparent", borderTopColor: "rgba(255,255,255,0.06)",
    transform: [{ rotate: "-5deg" }],
  },

  // ── Content card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 24,
    marginTop: -28,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 22, fontWeight: "700", color: "#6B7280",
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: 14, lineHeight: 20, color: "#9CA3AF",
    marginBottom: spacing.md + spacing.sm,
  },

  // ── Input ─────────────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: radii.md, overflow: "hidden",
    marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
  },
  inputRowError: { borderColor: "#EF4444" },
  prefix: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "#E5E7EB",
  },
  prefixText: { fontSize: 15, fontWeight: "600", color: "#9CA3AF", letterSpacing: 0.3 },
  input: {
    flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 16, letterSpacing: 1.5, color: "#000000",
  },
  charCount: { fontSize: 12, color: "#D1D5DB", paddingRight: spacing.sm },

  // ── Error ─────────────────────────────────────────────────────────────────
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm, paddingHorizontal: 2 },
  errorDot: { fontSize: 8, color: "#EF4444", lineHeight: 14 },
  errorText: { color: "#EF4444", fontSize: 13, flex: 1 },

  // ── Button ────────────────────────────────────────────────────────────────
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },

  // ── Disclaimer ────────────────────────────────────────────────────────────
  disclaimer: { fontSize: 12, textAlign: "center", lineHeight: 18, color: "#D1D5DB" },
  disclaimerLink: { color: "#192e21ff", fontWeight: "600" },
});
