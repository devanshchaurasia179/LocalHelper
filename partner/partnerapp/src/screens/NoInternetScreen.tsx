import { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radii } from "@/constants/theme";

type Props = {
  onRetry: () => void;
  isRetrying?: boolean;
};

export function NoInternetScreen({ onRetry, isRetrying = false }: Props) {
  // Subtle float animation on the wifi icon
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Icon */}
        <Animated.View
          style={[styles.iconWrap, { transform: [{ translateY: floatAnim }] }]}
        >
          <Ionicons name="wifi-outline" size={64} color={colors.primary} />
          {/* Red slash overlay */}
          <View style={styles.slashWrap} pointerEvents="none">
            <Ionicons name="close" size={36} color={colors.error} />
          </View>
        </Animated.View>

        {/* Text */}
        <Text style={styles.title}>No Internet Connection</Text>
        <Text style={styles.subtitle}>
          We couldn't reach the server. Check your Wi‑Fi or mobile data and try
          again.
        </Text>

        {/* Retry button */}
        <Pressable
          style={({ pressed }) => [
            styles.retryBtn,
            pressed && styles.retryBtnPressed,
            isRetrying && styles.retryBtnDisabled,
          ]}
          onPress={onRetry}
          disabled={isRetrying}
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
        >
          {isRetrying ? (
            <>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.retryBtnText}>Connecting…</Text>
            </>
          ) : (
            <>
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={styles.retryBtnText}>Try Again</Text>
            </>
          )}
        </Pressable>

        {/* Hint */}
        <Text style={styles.hint}>
          Your session is saved — you won't need to log in again once you're
          back online.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  slashWrap: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.oswaldBold,
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    width: "100%",
  },
  retryBtnPressed:  { opacity: 0.85 },
  retryBtnDisabled: { opacity: 0.6 },
  retryBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
  },
  hint: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
