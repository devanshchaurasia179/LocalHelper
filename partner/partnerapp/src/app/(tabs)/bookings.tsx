import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radii } from "@/constants/theme";
import BottomNav from "@/components/navigation/BottomNav";
import {
  usePendingBookings,
  useActiveBookings,
  usePartnerBookings,
  useAcceptBooking,
  useStartBooking,
  useCompleteBooking,
  useCancelBooking,
} from "@/hooks/useBookings";
import type { Booking } from "@/api/booking.api";

// ─── Tab Configuration ────────────────────────────────────────────────────────

type TabKey = "pending" | "active" | "completed" | "cancelled";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "New" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [refreshing, setRefreshing] = useState(false);

  const pendingQuery = usePendingBookings(activeTab === "pending");
  const activeQuery = useActiveBookings(activeTab === "active");
  const completedQuery = usePartnerBookings("completed", activeTab === "completed");
  const cancelledQuery = usePartnerBookings("cancelled", activeTab === "cancelled");

  const acceptMutation = useAcceptBooking();
  const startMutation = useStartBooking();
  const completeMutation = useCompleteBooking();
  const cancelMutation = useCancelBooking();

  const getActiveQuery = () => {
    switch (activeTab) {
      case "pending":
        return pendingQuery;
      case "active":
        return activeQuery;
      case "completed":
        return completedQuery;
      case "cancelled":
        return cancelledQuery;
    }
  };

  const currentQuery = getActiveQuery();
  const bookings: Booking[] =
    activeTab === "active"
      ? (activeQuery.data as any)?.bookings ?? []
      : (currentQuery.data as any)?.bookings ?? [];

  const pendingCount = pendingQuery.data?.bookings?.length ?? 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await currentQuery.refetch();
    setRefreshing(false);
  }, [currentQuery]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const showBadge = tab.key === "pending" && pendingCount > 0;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {currentQuery.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : bookings.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          bookings.map((booking) => (
            <BookingCard
              key={booking._id}
              booking={booking}
              tab={activeTab}
              onAccept={() => acceptMutation.mutate(booking._id)}
              onStart={() => startMutation.mutate(booking._id)}
              onComplete={() => completeMutation.mutate(booking._id)}
              onCancel={() => cancelMutation.mutate({ bookingId: booking._id })}
              isActioning={
                acceptMutation.isPending ||
                startMutation.isPending ||
                completeMutation.isPending ||
                cancelMutation.isPending
              }
            />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  tab,
  onAccept,
  onStart,
  onComplete,
  onCancel,
  isActioning,
}: {
  booking: Booking;
  tab: TabKey;
  onAccept: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
  isActioning: boolean;
}) {
  const isPending = booking.status === "pending";
  const isAccepted = booking.status === "accepted";
  const isInProgress = booking.status === "in_progress";

  const scheduledDate = new Date(booking.scheduledAt);
  const dateStr = scheduledDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = scheduledDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.card, isPending && styles.cardHighlight]}>
      {/* New badge for pending */}
      {isPending && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}

      {/* Emergency flag */}
      {booking.isEmergency && (
        <View style={styles.emergencyBadge}>
          <Ionicons name="warning" size={12} color={colors.error} />
          <Text style={styles.emergencyText}>Emergency</Text>
        </View>
      )}

      {/* Customer & Category */}
      <View style={styles.cardHeader}>
        <View style={styles.customerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={18} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>
              {booking.customer?.name ?? "Customer"}
            </Text>
            {booking.category?.name && (
              <Text style={styles.categoryText}>{booking.category.name}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Description */}
      {booking.description && (
        <Text style={styles.description} numberOfLines={2}>
          {booking.description}
        </Text>
      )}

      {/* Schedule & Location */}
      <View style={styles.infoRow}>
        <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.infoText}>
          {dateStr} • {timeStr}
        </Text>
      </View>

      {booking.serviceAddress?.locality && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>
            {booking.serviceAddress.locality}, {booking.serviceAddress.city}
          </Text>
        </View>
      )}

      {/* Visiting Credit */}
      {booking.visitingCredit != null && (
        <View style={styles.creditRow}>
          <Ionicons name="cash-outline" size={14} color={colors.success} />
          <Text style={styles.creditText}>₹{booking.visitingCredit}</Text>
        </View>
      )}

      {/* Action Buttons */}
      {tab === "pending" && isPending && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={onAccept}
            disabled={isActioning}
            accessibilityLabel="Accept booking"
          >
            <Ionicons name="checkmark" size={16} color={colors.white} />
            <Text style={styles.acceptBtnText}>Accept</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.cancelBtn]}
            onPress={onCancel}
            disabled={isActioning}
            accessibilityLabel="Cancel booking"
          >
            <Ionicons name="close" size={16} color={colors.white} />
            <Text style={styles.acceptBtnText}>Decline</Text>
          </Pressable>
        </View>
      )}

      {tab === "active" && isAccepted && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.startBtn]}
            onPress={onStart}
            disabled={isActioning}
            accessibilityLabel="Start work"
          >
            <Ionicons name="play" size={14} color={colors.white} />
            <Text style={styles.acceptBtnText}>Start Work</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.cancelBtn]}
            onPress={onCancel}
            disabled={isActioning}
            accessibilityLabel="Cancel booking"
          >
            <Ionicons name="close" size={16} color={colors.white} />
            <Text style={styles.acceptBtnText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {tab === "active" && isInProgress && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.completeBtn]}
            onPress={onComplete}
            disabled={isActioning}
            accessibilityLabel="Complete booking"
          >
            <Ionicons name="checkmark-done" size={16} color={colors.white} />
            <Text style={styles.acceptBtnText}>Complete</Text>
          </Pressable>
        </View>
      )}

      {/* Status badge for completed/cancelled */}
      {(tab === "completed" || tab === "cancelled") && (
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              booking.status === "completed"
                ? styles.statusCompleted
                : styles.statusCancelled,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                booking.status === "completed"
                  ? styles.statusCompletedText
                  : styles.statusCancelledText,
              ]}
            >
              {booking.status === "completed" ? "Completed" : "Cancelled"}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TabKey }) {
  const config: Record<TabKey, { icon: keyof typeof Ionicons.glyphMap; text: string }> = {
    pending: { icon: "hourglass-outline", text: "No new booking requests" },
    active: { icon: "briefcase-outline", text: "No active bookings" },
    completed: { icon: "checkmark-circle-outline", text: "No completed bookings yet" },
    cancelled: { icon: "close-circle-outline", text: "No cancelled bookings" },
  };
  const { icon, text } = config[tab];

  return (
    <View style={styles.emptyWrap}>
      <Ionicons name={icon} size={48} color={colors.navInactive} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.oswaldBold,
    fontSize: 26,
    color: colors.textPrimary,
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    gap: 4,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontFamily: fonts.jakartaMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  badge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 10,
    color: colors.white,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  center: {
    paddingTop: 60,
    alignItems: "center",
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardHighlight: {
    borderColor: colors.primary,
    backgroundColor: "#f0fdf8",
  },
  newBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 10,
    color: colors.white,
    letterSpacing: 0.5,
  },
  emergencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.sm,
  },
  emergencyText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 11,
    color: colors.error,
  },

  // Card header
  cardHeader: {
    marginBottom: spacing.sm,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  customerName: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  categoryText: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // Body
  description: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  infoText: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  creditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xs,
  },
  creditText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.success,
  },

  // Actions
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    flex: 1,
  },
  cancelBtn: {
    backgroundColor: colors.error,
    flex: 1,
  },
  startBtn: {
    backgroundColor: "#6366F1",
    flex: 1,
  },
  completeBtn: {
    backgroundColor: colors.success,
    flex: 1,
  },
  acceptBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.white,
  },

  // Status
  statusRow: {
    marginTop: spacing.md,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  statusCompleted: {
    backgroundColor: colors.successLight,
  },
  statusCancelled: {
    backgroundColor: colors.errorLight,
  },
  statusText: {
    fontFamily: fonts.jakartaMedium,
    fontSize: 12,
  },
  statusCompletedText: {
    color: colors.successDark,
  },
  statusCancelledText: {
    color: colors.errorDark,
  },

  // Empty
  emptyWrap: {
    paddingTop: 80,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
