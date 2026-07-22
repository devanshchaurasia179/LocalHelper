import { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import { usePendingBookings, useAcceptBooking } from "@/hooks/useBookings";
import { useServiceStatus, useToggleOnline, useDashboardStats } from "@/hooks/useServiceStatus";
import { colors, fonts, spacing, radii } from "@/constants/theme";
import BottomNav from "@/components/navigation/BottomNav";
import type { Booking } from "@/api/booking.api";

export default function HomeScreen() {
  const { partner } = useAuth();
  const { data } = usePartnerStatus();
  const router = useRouter();

  const { data: serviceData } = useServiceStatus();
  const toggleOnlineMutation = useToggleOnline();
  const { data: dashboardStats } = useDashboardStats();

  const { data: pendingData } = usePendingBookings();
  const acceptMutation = useAcceptBooking();

  const pendingBookings = pendingData?.bookings ?? [];
  const pendingCount = pendingBookings.length;

  const isOnline = serviceData?.isOnline ?? false;

  const name = data?.name ?? partner?.name ?? "Partner";
  const greeting = getGreeting();

  // Overview stats
  const todayBookings = dashboardStats?.todayBookings ?? pendingCount;
  const totalEarnings = dashboardStats?.totalEarnings ?? 0;
  const averageRating = dashboardStats?.averageRating ?? 0;

  const handleViewAllBookings = useCallback(() => {
    router.replace("/(tabs)/bookings" as any);
  }, [router]);

  const handleToggleOnline = useCallback(() => {
    toggleOnlineMutation.mutate(!isOnline);
  }, [isOnline, toggleOnlineMutation]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{name}</Text>
          </View>
          <Pressable style={styles.notificationBtn} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
            {pendingCount > 0 && <View style={styles.notifDot} />}
          </Pressable>
        </View>

        {/* Status Card with Toggle */}
        <View style={[styles.statusCard, !isOnline && styles.statusCardOffline]}>
          <View style={styles.statusCardContent}>
            <View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, !isOnline && styles.statusDotOffline]} />
                <Text style={styles.statusText}>
                  {isOnline ? "You're Online" : "You're Offline"}
                </Text>
              </View>
              <Text style={styles.statusSub}>
                {isOnline ? "Ready to receive bookings" : "Toggle to start receiving bookings"}
              </Text>
            </View>
            <View style={styles.toggleWrap}>
              {toggleOnlineMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Switch
                  value={isOnline}
                  onValueChange={handleToggleOnline}
                  trackColor={{ false: "rgba(255,255,255,0.3)", true: "#4ADE80" }}
                  thumbColor={colors.white}
                  accessibilityLabel={isOnline ? "Go offline" : "Go online"}
                />
              )}
            </View>
          </View>
        </View>

        {/* ─── NEW BOOKING REQUESTS ─────────────────────────────────────── */}
        {pendingCount > 0 && (
          <View style={styles.newBookingsSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>New Requests</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{pendingCount}</Text>
                </View>
              </View>
              <Pressable onPress={handleViewAllBookings} hitSlop={8}>
                <Text style={styles.viewAllText}>View All</Text>
              </Pressable>
            </View>

            {pendingBookings.slice(0, 3).map((booking) => (
              <PendingBookingCard
                key={booking._id}
                booking={booking}
                onAccept={() => acceptMutation.mutate(booking._id)}
                isAccepting={acceptMutation.isPending}
              />
            ))}
          </View>
        )}

        {/* Today's Overview */}
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <View style={styles.statsRow}>
          <StatCard
            icon="calendar"
            iconColor="#6366F1"
            iconBg="#EEF2FF"
            label="Bookings"
            value={String(todayBookings)}
          />
          <StatCard
            icon="cash"
            iconColor="#10B981"
            iconBg="#ECFDF5"
            label="Earnings"
            value={`₹${totalEarnings}`}
          />
          <StatCard
            icon="star"
            iconColor="#F59E0B"
            iconBg="#FFFBEB"
            label="Rating"
            value={averageRating > 0 ? averageRating.toFixed(1) : "--"}
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionCard icon="time-outline" label="Availability" color="#6366F1" />
          <ActionCard icon="pricetag-outline" label="My Services" color="#10B981" />
          <ActionCard icon="document-text-outline" label="Documents" color="#F59E0B" />
          <ActionCard icon="help-circle-outline" label="Support" color="#EF4444" />
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {pendingCount === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="folder-open-outline" size={40} color={colors.navInactive} />
            <Text style={styles.emptyText}>No recent activity yet</Text>
            <Text style={styles.emptySubtext}>
              Your booking activity will show up here
            </Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="notifications" size={40} color={colors.primary} />
            <Text style={styles.emptyText}>
              {pendingCount} booking{pendingCount > 1 ? "s" : ""} waiting
            </Text>
            <Text style={styles.emptySubtext}>
              Tap "New Requests" above to review and accept
            </Text>
          </View>
        )}

        {/* Spacer for bottom nav */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

// ─── Pending Booking Card (Home Page) ─────────────────────────────────────────

function PendingBookingCard({
  booking,
  onAccept,
  isAccepting,
}: {
  booking: Booking;
  onAccept: () => void;
  isAccepting: boolean;
}) {
  const scheduledDate = new Date(booking.scheduledAt);
  const dateStr = scheduledDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  const timeStr = scheduledDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={styles.pendingCard}>
      {/* Pulsing dot indicator */}
      <View style={styles.pulseIndicator} />

      <View style={styles.pendingCardBody}>
        <View style={styles.pendingCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingCustomerName}>
              {booking.customer?.name ?? "Customer"}
            </Text>
            <Text style={styles.pendingCategory}>
              {booking.category?.name ?? "Service Request"}
            </Text>
          </View>
          {booking.isEmergency && (
            <View style={styles.emergencyChip}>
              <Ionicons name="flash" size={10} color={colors.error} />
              <Text style={styles.emergencyChipText}>Urgent</Text>
            </View>
          )}
        </View>

        <View style={styles.pendingInfoRow}>
          <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.pendingInfoText}>
            {dateStr} • {timeStr}
          </Text>
          {booking.visitingCredit != null && (
            <>
              <Text style={styles.pendingInfoDot}>•</Text>
              <Text style={styles.pendingCreditText}>₹{booking.visitingCredit}</Text>
            </>
          )}
        </View>

        {/* Accept button */}
        <Pressable
          style={styles.miniAcceptBtn}
          onPress={onAccept}
          disabled={isAccepting}
          accessibilityLabel="Accept this booking"
        >
          <Ionicons name="checkmark" size={14} color={colors.white} />
          <Text style={styles.miniAcceptText}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <Pressable style={styles.actionCard} accessibilityLabel={label}>
      <View style={[styles.actionIconWrap, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  greeting: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  name: {
    fontFamily: fonts.oswaldBold,
    fontSize: 26,
    color: colors.textPrimary,
    marginTop: 2,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.surface,
  },

  // Status card
  statusCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  statusCardOffline: {
    backgroundColor: "#4B5563",
  },
  statusCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4ADE80",
  },
  statusDotOffline: {
    backgroundColor: "#9CA3AF",
  },
  statusText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 16,
    color: colors.white,
  },
  statusSub: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginLeft: 18,
  },
  toggleWrap: {
    minWidth: 51,
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── New Bookings Section ─────────────────────────────────────────────────
  newBookingsSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  countBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 11,
    color: colors.white,
  },
  viewAllText: {
    fontFamily: fonts.jakartaMedium,
    fontSize: 13,
    color: colors.primary,
  },

  // Pending booking card (compact)
  pendingCard: {
    flexDirection: "row",
    backgroundColor: "#f0fdf8",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  pendingCardBody: {
    flex: 1,
  },
  pendingCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  pendingCustomerName: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  pendingCategory: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  emergencyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.errorLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  emergencyChipText: {
    fontFamily: fonts.jakartaMedium,
    fontSize: 10,
    color: colors.error,
  },
  pendingInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  pendingInfoText: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  pendingInfoDot: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  pendingCreditText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 12,
    color: colors.success,
  },
  miniAcceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  miniAcceptText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 12,
    color: colors.white,
  },

  // Section title
  sectionTitle: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontFamily: fonts.oswaldSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Actions grid
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontFamily: fonts.jakartaMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },

  // Empty state
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
});
