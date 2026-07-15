import { useEffect, useRef, useState } from "react";
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
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/constants/theme";
import { Spacing } from "@/constants/theme";
import { ROUTES } from "@/constants/routes";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function VerifyOtpScreen() {
  // ── ALL hooks first — no early returns before this block ─────────────────
  const { confirmOtp, requestOtp, status } = useAuth();
  const theme = useTheme();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer runs only when there is a valid phone param
  useEffect(() => {
    if (!phone) return;

    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [phone]);

  // ── Conditional redirects AFTER all hooks ────────────────────────────────
  if (status === "authenticated") {
    return <Redirect href={ROUTES.APP.HOME as any} />;
  }

  if (!phone) {
    return <Redirect href={ROUTES.AUTH.SEND_OTP as any} />;
  }

  // ── Derived state & handlers ─────────────────────────────────────────────
  const isReady = otp.length === OTP_LENGTH;

  const resetCooldown = () => {
    clearInterval(timerRef.current!);
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    if (!isReady || loading) return;
    setError(null);
    setLoading(true);
    try {
      const customer = await confirmOtp(phone, otp);
      if (!customer.isOnboarded) {
        router.replace(ROUTES.ONBOARDING.PROFILE as any);
      }
      // authenticated + onboarded → index.tsx redirect handles it
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Invalid OTP. Please try again.");
      setOtp("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setError(null);
    setOtp("");
    setResending(true);
    try {
      await requestOtp(phone);
      resetCooldown();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Could not resend OTP.");
    } finally {
      setResending(false);
    }
  };

  const digits = otp.padEnd(OTP_LENGTH, " ").split("");

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          {/* Back button */}
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={[styles.backText, { color: theme.textSecondary }]}>
              ← Back
            </Text>
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Enter OTP</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              We sent a 6-digit code to{"\n"}
              <Text style={[styles.phone, { color: theme.text }]}>
                +91 {phone}
              </Text>
            </Text>
          </View>

          {/* Digit boxes */}
          <Pressable
            style={styles.digitsRow}
            onPress={() => inputRef.current?.focus()}
            accessibilityLabel="OTP input area"
          >
            {digits.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.digitBox,
                  { backgroundColor: theme.backgroundElement },
                  i === otp.length && styles.digitBoxActive,
                  d.trim() !== "" && {
                    backgroundColor: theme.backgroundSelected,
                  },
                ]}
              >
                <Text style={[styles.digitText, { color: theme.text }]}>
                  {d.trim()}
                </Text>
              </View>
            ))}
          </Pressable>

          {/* Hidden real input */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            value={otp}
            onChangeText={(t) => {
              setError(null);
              setOtp(t.replace(/\D/g, ""));
            }}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
            autoFocus
            accessibilityLabel="OTP digits"
          />

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Verify CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              (!isReady || loading) && styles.buttonDisabled,
              pressed && isReady && !loading && styles.buttonPressed,
            ]}
            onPress={handleVerify}
            disabled={!isReady || loading}
            accessibilityRole="button"
            accessibilityLabel="Verify OTP"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </Pressable>

          {/* Resend */}
          <Pressable
            style={styles.resendRow}
            onPress={handleResend}
            disabled={resending || cooldown > 0}
            accessibilityRole="button"
            accessibilityLabel="Resend OTP"
          >
            {resending ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : cooldown > 0 ? (
              <Text style={[styles.resendText, { color: theme.textSecondary }]}>
                Resend OTP in{" "}
                <Text style={{ fontWeight: "600" }}>{cooldown}s</Text>
              </Text>
            ) : (
              <Text style={[styles.resendText, { color: "#2563EB" }]}>
                Resend OTP
              </Text>
            )}
          </Pressable>
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
  backButton: {
    position: "absolute",
    top: Spacing.four,
    left: Spacing.four,
    paddingVertical: Spacing.one,
  },
  backText: { fontSize: 15 },
  header: { gap: Spacing.one, marginBottom: Spacing.two },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  phone: { fontWeight: "600" },
  digitsRow: {
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "center",
    marginTop: Spacing.one,
  },
  digitBox: {
    width: 46,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  digitBoxActive: { borderColor: "#2563EB" },
  digitText: { fontSize: 22, fontWeight: "700" },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 0,
    height: 0,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    marginTop: -Spacing.two,
  },
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
  resendRow: { alignItems: "center", paddingVertical: Spacing.two },
  resendText: { fontSize: 14 },
});
