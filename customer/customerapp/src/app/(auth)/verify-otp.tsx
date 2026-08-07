import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, radii } from "@/app/(tabs)/home/theme";
import { ROUTES } from "@/constants/routes";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function VerifyOtpScreen() {
  const { confirmOtp, requestOtp, status } = useAuth();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!phone) return;
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phone]);

  // Track keyboard height manually — more reliable than KAV on Android
  // when the screen navigates in while the keyboard is already open or
  // opens immediately on mount.
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => { subShow.remove(); subHide.remove(); };
  }, []);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (status === "authenticated") return <Redirect href={ROUTES.APP.HOME as any} />;
  if (!phone) return <Redirect href={ROUTES.AUTH.SEND_OTP as any} />;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const isReady = otp.length === OTP_LENGTH;

  const resetCooldown = () => {
    clearInterval(timerRef.current!);
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
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
      } else {
        router.replace(ROUTES.APP.HOME as any);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Invalid OTP. Please try again.");
      setOtp("");
      setTimeout(() => inputRef.current?.focus(), 100);
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
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Could not resend OTP.");
    } finally {
      setResending(false);
    }
  };

  const focusInput = () => {
    inputRef.current?.blur();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const digits = otp.padEnd(OTP_LENGTH, " ").split("");

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {/*
        We manage keyboard offset ourselves via paddingBottom on the root view.
        This avoids KAV timing issues when the screen navigates in while
        the keyboard is already opening — KAV can miss the event entirely.
        
        When keyboardHeight > 0 the hero shrinks (flex:1) and the card
        rides up exactly like send-otp. When keyboard hides, keyboardHeight
        resets to 0, hero expands, everything falls back naturally.
      */}
      <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>

        {/* ── Hero — flex:1 compresses to absorb keyboard offset ───── */}
        <View style={styles.hero}>
          <View style={styles.triTopRight}      pointerEvents="none" />
          <View style={styles.triTopRightInner} pointerEvents="none" />
          <View style={styles.triBottomLeft}    pointerEvents="none" />
          <View style={styles.triMidRight}      pointerEvents="none" />
          <View style={styles.triMidLeft}       pointerEvents="none" />
          <View style={styles.triBottomRight}   pointerEvents="none" />

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.appName}>LocalHelpers</Text>
          <Text style={styles.heroTitle}>Verify your{"\n"}mobile number</Text>
          <Text style={styles.heroSub}>
            Code sent to <Text style={styles.heroPhone}>+91 {phone}</Text>
          </Text>
        </View>

        {/* ── Card — no flex, content-height, rises with padding ────── */}
        <View style={[styles.card, { backgroundColor: "#FFFFFF" }]}>
          <View style={styles.handle} />

          <Text style={styles.cardTitle}>Enter OTP</Text>
          <Text style={styles.cardSubtitle}>
            Type the 6-digit code we just sent you
          </Text>

          {/* Tapping anywhere on the row re-opens keyboard */}
          <Pressable
            style={styles.digitsRow}
            onPress={focusInput}
            accessibilityLabel="OTP input area"
          >
            {digits.map((d, i) => {
              const filled = d.trim() !== "";
              const active = i === otp.length && otp.length < OTP_LENGTH;
              return (
                <View
                  key={i}
                  style={[
                    styles.digitBox,
                    { backgroundColor: "#FFFFFF" },
                    active && styles.digitBoxActive,
                    filled && styles.digitBoxFilled,
                  ]}
                >
                  <Text style={styles.digitText}>{filled ? d : ""}</Text>
                </View>
              );
            })}
          </Pressable>

          {/* Hidden input — real size so Android keyboard attaches reliably */}
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
            showSoftInputOnFocus
            caretHidden
            accessibilityLabel="OTP digits"
          />

          {error ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorDot}>●</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Verify OTP</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.resendRow}
            onPress={handleResend}
            disabled={resending || cooldown > 0}
            accessibilityRole="button"
            accessibilityLabel="Resend OTP"
          >
            {resending ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : cooldown > 0 ? (
              <Text style={styles.resendCooldown}>
                Resend OTP in <Text style={styles.resendTimer}>{cooldown}s</Text>
              </Text>
            ) : (
              <Text style={styles.resendActive}>Resend OTP</Text>
            )}
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },

  // Hero — flex:1 absorbs the paddingBottom offset, compressing upward
  hero: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingTop: 64,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl + 24,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  backBtn: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  backBtnText: { fontSize: 14, color: colors.white, fontWeight: "600" },
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
  heroPhone: { color: colors.white, fontWeight: "700" },

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

  // Card — no flex, sits at bottom, rises as paddingBottom grows
  card: {
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    paddingHorizontal: spacing.md,
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

  // Digit boxes
  digitsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  digitBox: {
    width: 46, height: 56,
    borderRadius: radii.sm + 2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
  },
  digitBoxActive: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  digitBoxFilled: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.primary,
  },
  digitText: { fontSize: 22, fontWeight: "700", color: "#000000" },

  hiddenInput: {
    position: "absolute",
    left: -500,
    top: 0,
    width: 40,
    height: 40,
    opacity: 0,
  },

  // Error
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  errorDot: { fontSize: 8, color: "#EF4444", lineHeight: 14 },
  errorText: { color: "#EF4444", fontSize: 13, flex: 1 },

  // Button
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xs, marginBottom: spacing.md,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed:  { opacity: 0.82 },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Resend
  resendRow: { alignItems: "center", paddingVertical: spacing.sm },
  resendCooldown: { fontSize: 14, color: "#D1D5DB" },
  resendTimer: { fontWeight: "700", color: "#9CA3AF" },
  resendActive: { fontSize: 14, fontWeight: "700", color: "#86EFAC" },
});
