import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";

import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import { useAuth } from "@/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";
import { colors, fonts, radii, spacing } from "@/constants/theme";

const DEFAULT_SUSPENSION_MESSAGE =
  "Your account has been temporarily suspended by the admin. This may be due to policy violations or pending review.";

// ─── Colors specific to the suspended state ───────────────────────────────────
const warningColors = {
  bg: "#FFFBEB",
  border: "#FDE68A",
  dark: "#92400E",
  icon: "#F59E0B",
};

export default function SuspendedScreen() {
  const router = useRouter();
  const { signOut, status, partner } = useAuth();
  const { data, isLoading, isFetching, isError, error, refetch } = usePartnerStatus({
    refetchInterval: 60_000, // poll every 60s in case admin lifts suspension
  });

  // Navigate to login when signed out
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(ROUTES.AUTH.SEND_OTP as any);
    }
  }, [status, router]);

  if (status === "unauthenticated") {
    return null;
  }

  // Get reason from successful response, 403 error response, or auth context
  const reason = (() => {
    if (data?.statusReason) return data.statusReason.trim();
    if (
      isError &&
      axios.isAxiosError(error) &&
      error.response?.status === 403 &&
      error.response?.data?.statusReason
    ) {
      return error.response.data.statusReason.trim();
    }
    if (partner?.statusReason) return partner.statusReason.trim();
    return DEFAULT_SUSPENSION_MESSAGE;
  })();

  // A 403 with accountStatus is expected — not an actual error for this screen
  const isActualError =
    isError &&
    !(
      axios.isAxiosError(error) &&
      error.response?.status === 403 &&
      error.response?.data?.accountStatus
    );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <SuspendedSkeleton />
      </SafeAreaView>
    );
  }

  if (isActualError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.error} />
          </View>
          <Text style={styles.errorTitle}>Unable to Load Status</Text>
          <Text style={styles.errorMessage}>
            Network error. Check your connection and try again.
          </Text>
          <Pressable
            style={[styles.retryBtn, isFetching && styles.btnDisabled]}
            onPress={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.retryBtnText}>Try Again</Text>
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
      >
        {/* Illustration */}
        <View style={styles.illustrationWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="pause-circle" size={56} color={warningColors.icon} />
          </View>
          <View style={styles.alertBadge}>
            <Ionicons name="time" size={16} color={colors.white} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Account Suspended</Text>

        {/* Status badge */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>Temporarily Suspended</Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Your account access has been temporarily restricted. You cannot accept
          new bookings or access partner features until the suspension is lifted.
        </Text>

        {/* Reason card */}
        <View style={styles.reasonCard}>
          <View style={styles.reasonHeader}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={warningColors.dark}
            />
            <Text style={styles.reasonLabel}>Reason</Text>
          </View>
          <Text style={styles.reasonText}>{reason}</Text>
        </View>

        {/* Tip card */}
        <View style={styles.tipCard}>
          <Ionicons
            name="bulb-outline"
            size={20}
            color={colors.textSecondary}
            style={styles.tipIcon}
          />
          <Text style={styles.tipText}>
            Suspensions are usually temporary. If you believe this is a mistake
            or need more information, please contact our support team.
          </Text>
        </View>

        {/* Contact support button */}
        <Pressable
          style={styles.contactBtn}
          onPress={() => Linking.openURL("mailto:support@localhelpers.in")}
          accessibilityRole="button"
          accessibilityLabel="Contact support"
        >
          <Ionicons name="mail-outline" size={22} color={colors.white} />
          <Text style={styles.contactBtnText}>Contact Support</Text>
        </Pressable>

        {/* Sign out */}
        <Pressable
          style={styles.signOutBtn}
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SuspendedSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonCircle} />
      <View style={[styles.skeletonLine, { width: "60%" }]} />
      <View style={[styles.skeletonLine, { width: "80%" }]} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonBtn} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // Illustration
  illustrationWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: warningColors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: warningColors.border,
  },
  alertBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: warningColors.dark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
  },

  // Title & badge
  title: {
    fontFamily: fonts.oswaldBold,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  statusBadge: {
    backgroundColor: warningColors.bg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: warningColors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  statusBadgeText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 12,
    color: warningColors.dark,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  subtitle: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.lg,
    maxWidth: 340,
  },

  // Reason card
  reasonCard: {
    width: "100%",
    backgroundColor: warningColors.bg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: warningColors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  reasonLabel: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: warningColors.dark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reasonText: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: warningColors.dark,
    lineHeight: 24,
  },

  // Tip card
  tipCard: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    alignItems: "flex-start",
  },
  tipIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Buttons
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    minHeight: 52,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: spacing.md,
  },
  contactBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.3,
  },
  signOutBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  signOutBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.85,
  },

  // Error
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
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 140,
    alignItems: "center",
  },
  retryBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
  },

  // Skeleton
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
    height: 100,
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
