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
import { useTheme } from "@/constants/theme";
import { Spacing } from "@/constants/theme";
import { ROUTES } from "@/constants/routes";

export default function SendOtpScreen() {
  // ── ALL hooks first — no early returns before this block ─────────────────
  const { requestOtp, status } = useAuth();
  const theme = useTheme();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Conditional redirect AFTER all hooks ─────────────────────────────────
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
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Welcome</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enter your mobile number to get started
            </Text>
          </View>

          {/* Phone input */}
          <View
            style={[
              styles.inputRow,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View
              style={[
                styles.prefix,
                { borderRightColor: theme.backgroundSelected },
              ]}
            >
              <Text style={[styles.prefixText, { color: theme.text }]}>
                +91
              </Text>
            </View>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="10-digit mobile number"
              placeholderTextColor={theme.textSecondary}
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
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </Pressable>

          <Text style={[styles.disclaimer, { color: theme.textSecondary }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.two },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    overflow: "hidden",
  },
  prefix: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  prefixText: { fontSize: 16, fontWeight: "600" },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    letterSpacing: 1.5,
  },
  errorText: { color: "#EF4444", fontSize: 13, marginTop: -Spacing.two },
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginTop: Spacing.one,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disclaimer: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: Spacing.one,
  },
});
