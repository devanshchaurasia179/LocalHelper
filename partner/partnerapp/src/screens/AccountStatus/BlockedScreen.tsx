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

const DEFAULT_BLOCK_MESSAGE =
  "Your account has been permanently blocked due to repeated policy violations. You can no longer access partner features.";

// ─── Color tokens for blocked state ──────────────────────────────────────────
const C = {
  bg: "#FEF2F2",
  border: "#FECACA",
  dark: "#991B1B",
  mid: "#DC2626",
  icon: "#EF4444",
  headerBg: "#991B1B",
};

export default function BlockedScreen() {
  const router = useRouter();
  const { signOut, status, partner } = useAuth();
  const { data, isLoading, isFetching, isError, refetch } = usePartnerStatus();

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
    DEFAULT_BLOCK_MESSAGE;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <BlockedSkeleton />
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
            <Ionicons name="ban" size={52} color={colors.white} />
          </View>
          <View style={styles.alertBadge}>
            <Ionicons name="close" size={14} color={colors.white} />
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

      {/* Scrollable body — starts below the band */}
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
        <Text style={styles.title}>Account Blocked</Text>

        {/* Status pill */}
        <View style={styles.pill}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>Permanently Blocked</Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Your partner account has been blocked. You will not be able to receive
          bookings, access earnings, or use any partner features.
        </Text>

        {/* Reason card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={20} color={C.dark} />
            <Text style={styles.cardLabel}>Reason for Block</Text>
          </View>
          <Text style={styles.cardBody}>{reason}</Text>
        </View>

        {/* Impact list */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="warning-outline" size={20} color={C.dark} />
            <Text style={styles.cardLabel}>What this means</Text>
          </View>
          <ImpactRow text="Cannot accept or receive new bookings" />
          <ImpactRow text="Profile is hidden from all customers" />
          <ImpactRow text="Pending payouts may be held for review" />
        </View>

        {/* Tip */}
        <View style={styles.tipRow}>
          <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.tipText}>
            If you believe this was a mistake, reach out to our support team for
            an account review.
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

// ─── Sub-components ────────────────────────────────────────────────────────────

function ImpactRow({ text }: { text: string }) {
  return (
    <View style={styles.impactRow}>
      <View style={styles.bullet} />
      <Text style={styles.impactText}>{text}</Text>
    </View>
  );
}

function BlockedSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={[styles.skeletonCircle, { backgroundColor: C.bg }]} />
      <View style={[styles.skeletonLine, { width: "50%" }]} />
      <View style={[styles.skeletonLine, { width: "30%", height: 24, borderRadius: 12 }]} />
      <View style={[styles.skeletonLine, { width: "90%" }]} />
      <View style={[styles.skeletonLine, { width: "80%" }]} />
      <View style={styles.skeletonCard} />
      <View style={[styles.skeletonCard, { height: 90 }]} />
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

  // Impact rows
  impactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: 6,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.mid,
    marginTop: 9,
    flexShrink: 0,
  },
  impactText: {
    flex: 1,
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: C.dark,
    lineHeight: 23,
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
    lineHeight: 21,
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
    marginBottom: spacing.sm,
  },
  skeletonBtn: {
    width: "100%",
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.lg,
  },
});
