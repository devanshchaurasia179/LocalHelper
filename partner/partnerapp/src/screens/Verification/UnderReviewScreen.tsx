import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import axios from "axios";

import { useVerificationStatusRefresh } from "@/hooks/useVerificationStatusRefresh";
import { colors, fonts, radii, spacing } from "@/constants/theme";

const POLL_INTERVAL_MS = 45_000;

export default function UnderReviewScreen() {
  const {
    isLoading,
    isRefreshing,
    isError,
    error,
    refresh,
  } = useVerificationStatusRefresh({
    pollIntervalMs: POLL_INTERVAL_MS,
    screen: "under-review",
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <UnderReviewSkeleton />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.error} />
          </View>
          <Text style={styles.errorTitle}>Unable to Load Status</Text>
          <Text style={styles.errorMessage}>{getErrorMessage(error)}</Text>
          <Pressable
            style={[styles.refreshBtn, isRefreshing && styles.refreshBtnDisabled]}
            onPress={refresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.refreshBtnText}>Try Again</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.success}
            colors={[colors.success]}
          />
        }
      >
        <SuccessIllustration />

        <Text style={styles.title}>Documents Under Review</Text>

        <Text style={styles.message}>
          Your documents have been submitted successfully. Our verification team
          is reviewing your KYC.
        </Text>

        <View style={styles.timeCard}>
          <View style={styles.timeIconWrap}>
            <Ionicons name="time-outline" size={28} color={colors.successDark} />
          </View>
          <View style={styles.timeTextWrap}>
            <Text style={styles.timeLabel}>Estimated review time</Text>
            <Text style={styles.timeValue}>24–48 hours</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={colors.success}
            style={styles.infoIcon}
          />
          <Text style={styles.infoText}>
            We will notify you once the review is complete. You can also pull
            down or tap below to check for updates.
          </Text>
        </View>

        <Pressable
          style={[styles.refreshBtn, isRefreshing && styles.refreshBtnDisabled]}
          onPress={refresh}
          disabled={isRefreshing}
          accessibilityRole="button"
          accessibilityLabel="Refresh verification status"
        >
          {isRefreshing ? (
            <>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={styles.refreshBtnText}>Checking Status…</Text>
            </>
          ) : (
            <>
              <Ionicons name="refresh" size={20} color={colors.white} />
              <Text style={styles.refreshBtnText}>Refresh Status</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SuccessIllustration() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.12, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <View style={styles.illustrationWrap}>
      <Animated.View style={[styles.pulseRing, ringStyle]} />
      <View style={styles.iconCircle}>
        <Ionicons name="shield-checkmark" size={56} color={colors.success} />
      </View>
      <View style={styles.checkBadge}>
        <Ionicons name="checkmark" size={18} color={colors.white} />
      </View>
    </View>
  );
}

function UnderReviewSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonCircle} />
      <View style={[styles.skeletonLine, { width: "70%" }]} />
      <View style={[styles.skeletonLine, { width: "90%" }]} />
      <View style={[styles.skeletonLine, { width: "80%" }]} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonBtn} />
    </View>
  );
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && (!error.response || error.code === "ERR_NETWORK")) {
    return "Network error. Check your connection and try again.";
  }
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  return "Something went wrong while checking your verification status.";
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl + 16,
    alignItems: "center",
  },

  illustrationWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  pulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.successLight,
    borderWidth: 2,
    borderColor: colors.successBorder,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.successBorder,
  },
  checkBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
  },

  title: {
    fontFamily: fonts.oswaldBold,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.md,
    letterSpacing: 0.3,
  },
  message: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.lg,
    maxWidth: 340,
  },

  timeCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: colors.successLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  timeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  timeTextWrap: {
    flex: 1,
  },
  timeLabel: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.successDark,
    marginBottom: 2,
  },
  timeValue: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 18,
    color: colors.successDark,
  },

  infoCard: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    alignItems: "flex-start",
  },
  infoIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    backgroundColor: colors.success,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    minHeight: 52,
    shadowColor: colors.successDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  refreshBtnDisabled: {
    opacity: 0.85,
  },
  refreshBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.3,
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  errorIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  errorMessage: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
    maxWidth: 300,
  },

  skeletonWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: "center",
  },
  skeletonCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.lg,
  },
  skeletonLine: {
    height: 14,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  skeletonCard: {
    width: "100%",
    height: 80,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  skeletonBtn: {
    width: "100%",
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
});
