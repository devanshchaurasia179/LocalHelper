import { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Linking,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import { useAuth } from "@/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";
import { colors, fonts, radii, spacing } from "@/constants/theme";

const DEFAULT_SUSPENSION_MESSAGE =
  "Your account has been temporarily suspended by the admin. This may be due to policy violations or pending review.";

// ─── Color tokens for suspended state ────────────────────────────────────────
const C = {
  bg: "#FFFBEB",
  border: "#FDE68A",
  dark: "#92400E",
  mid: "#D97706",
  icon: "#F59E0B",
  headerBg: "#92400E",
};

export default function SuspendedScreen() {
  const router = useRouter();
  const { signOut, status, partner } = useAuth();
  const { data, isLoading, isFetching, isError, refetch } = usePartnerStatus({
    refetchInterval: 60_000, // poll every 60 s in case admin lifts suspension
  });

  // Spinning animation for refresh button
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isFetching) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [isFetching, spinAnim]);

  const spinStyle = {
    transform: [
      {
        rotate: spinAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        }),
      },
    ],
  };

  // Redirect to login when signed out
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(ROUTES.AUTH.SEND_OTP as any);
    }
  }, [status, router]);

  if (status === "unauthenticated") return null;

  const reason =
    (data?.statusReason ?? partner?.statusReason ?? "").trim() ||
    DEFAULT_SUSPENSION_MESSAGE;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <SuspendedSkeleton />
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.errorContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={C.icon}
              colors={[C.icon]}
            />
          }
        >
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={48} color={C.icon} />
          </View>
          <Text style={styles.errorTitle}>Unable to Load Status</Text>
          <Text style={styles.errorMessage}>
            Check your connection and pull down to retry.
          </Text>
          <Pressable
            style={[styles.retryBtn, isFetching && styles.btnDisabled]}
            onPress={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.retryBtnText}>Try Again</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Coloured header band */}
      <View style={styles.headerBand}>
        <SafeAreaView edges={["top"]} />
        <View style={styles.headerContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="pause-circle" size={52} color={colors.white} />
          </View>
          <View style={styles.alertBadge}>
            <Ionicons name="time" size={14} color={colors.white} />
          </View>
          {/* Refresh button */}
          <Pressable
            style={styles.refreshBtn}
            onPress={() => refetch()}
            disabled={isFetching}
            accessibilityRole="button"
            accessibilityLabel="Refresh account status"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View style={spinStyle}>
              <Ionicons name="refresh" size={20} color="rgba(255,255,255,0.9)" />
            </Animated.View>
          </Pressable>
        </View>
      </View>

      {/* Scrollable body — overlaps the band with a rounded top */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={C.icon}
            colors={[C.icon]}
          />
        }
      >
        {/* Title */}
        <Text style={styles.title}>Account Suspended</Text>

        {/* Status pill */}
        <View style={styles.pill}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>Temporarily Suspended</Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Your account access has been temporarily restricted. You cannot accept
          new bookings or use partner features until the suspension is lifted.
        </Text>

        {/* Reason card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={20} color={C.dark} />
            <Text style={styles.cardLabel}>Reason</Text>
          </View>
          <Text style={styles.cardBody}>{reason}</Text>
        </View>

        {/* Auto-check notice */}
        <View style={styles.noticeRow}>
          <Ionicons name="refresh-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.noticeText}>
            Status is checked automatically every minute. Pull down to check
            now.
          </Text>
        </View>

        {/* Tip */}
        <View style={styles.tipRow}>
          <Ionicons name="bulb-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.tipText}>
            Suspensions are usually temporary. Contact support if you believe
            this is a mistake or need more information.
          </Text>
        </View>

        {/* CTA buttons */}
        <Pressable
          style={styles.primaryBtn}
          onPress={() => Linking.openURL("mailto:support@localhelpers.in")}
          accessibilityRole="button"
          accessibilityLabel="Contact support"
        >
          <Ionicons name="mail-outline" size={20} color={colors.white} />
          <Text style={styles.primaryBtnText}>Contact Support</Text>
        </Pressable>

        <Pressable
          style={styles.ghostBtn}
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.ghostBtnText}>Sign Out</Text>
        </Pressable>

        <SafeAreaView edges={["bottom"]} />
      </ScrollView>
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SuspendedSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={[styles.skeletonCircle, { backgroundColor: C.bg }]} />
      <View style={[styles.skeletonLine, { width: "50%" }]} />
      <View style={[styles.skeletonLine, { width: "35%", height: 24, borderRadius: 12 }]} />
      <View style={[styles.skeletonLine, { width: "90%" }]} />
      <View style={[styles.skeletonLine, { width: "75%" }]} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonBtn} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header band
  headerBand: {
    backgroundColor: C.headerBg,
    paddingBottom: spacing.xl + 8,
  },
  headerContent: {
    alignItems: "center",
    paddingTop: spacing.lg,
    width: "100%",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  alertBadge: {
    position: "absolute",
    bottom: 0,
    right: "33%",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.mid,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: C.headerBg,
  },
  refreshBtn: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  // Scrollable body
  scroll: {
    flex: 1,
    marginTop: -spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: "center",
  },

  // Title & pill
  title: {
    fontFamily: fonts.oswaldBold,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
    letterSpacing: 0.4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.bg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.mid,
  },
  pillText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 12,
    color: C.dark,
    textTransform: "uppercase",
    letterSpacing: 0.7,
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

  // Card
  card: {
    width: "100%",
    backgroundColor: C.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  cardLabel: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 13,
    color: C.dark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardBody: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: C.dark,
    lineHeight: 24,
  },

  // Notice row
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Tip
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Buttons
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    backgroundColor: C.dark,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    minHeight: 52,
    marginBottom: spacing.sm,
    elevation: 2,
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  primaryBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.3,
  },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  ghostBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  btnDisabled: {
    opacity: 0.7,
  },

  // Error state
  errorContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  errorIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.bg,
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
    backgroundColor: C.dark,
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
    width: 96,
    height: 96,
    borderRadius: 48,
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
    height: 110,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  skeletonBtn: {
    width: "100%",
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
});
