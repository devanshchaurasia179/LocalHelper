import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import {
  getPartnerBookings,
  acceptBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  Booking,
  BookingStatus,
} from "@/constants/booking.api";

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = "active" | "past";

const ACTIVE_STATUSES: BookingStatus[] = ["pending", "accepted", "in_progress"];
const PAST_STATUSES: BookingStatus[] = ["completed", "cancelled"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddress(addr?: Booking["serviceAddress"]) {
  if (!addr) return null;
  return [addr.house, addr.street, addr.locality, addr.city, addr.state, addr.pincode]
    .filter(Boolean)
    .join(", ");
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bg: string; text: string }
> = {
  pending:     { label: "Pending",     bg: "#fef3c7", text: "#92400e" },
  accepted:    { label: "Accepted",    bg: "#dbeafe", text: "#1e40af" },
  in_progress: { label: "In Progress", bg: "#dcfce7", text: "#166534" },
  completed:   { label: "Completed",   bg: "#f0fdf4", text: "#15803d" },
  cancelled:   { label: "Cancelled",   bg: "#fee2e2", text: "#991b1b" },
};

function StatusBadge({ status }: { status: BookingStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[badge.root, { backgroundColor: cfg.bg }]}>
      <ThemedText style={[badge.text, { color: cfg.text }]}>{cfg.label}</ThemedText>
    </View>
  );
}

const badge = StyleSheet.create({
  root: {
    alignSelf: "flex-start",
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  text: { fontSize: 12, fontWeight: "700" },
});

// ─── Cancel modal ─────────────────────────────────────────────────────────────

function CancelModal({
  visible,
  onClose,
  onConfirm,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const colors = useTheme();
  const [reason, setReason] = useState("");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <ThemedView style={[modal.box, { maxWidth: MaxContentWidth }]}>
          <ThemedText type="subtitle" style={{ marginBottom: Spacing.two }}>
            Cancel Booking
          </ThemedText>
          <ThemedText type="small" style={{ color: colors.text, marginBottom: Spacing.three }}>
            Provide a reason (optional).
          </ThemedText>
          <TextInput
            style={[
              modal.input,
              {
                color: colors.text,
                borderColor: colors.backgroundElement,
                backgroundColor: colors.backgroundElement,
              },
            ]}
            placeholder="e.g. Schedule conflict"
            placeholderTextColor={colors.text}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={modal.actions}>
            <TouchableOpacity
              style={[modal.btn, { backgroundColor: colors.backgroundElement }]}
              onPress={onClose}
              disabled={loading}
            >
              <ThemedText type="small" style={{ fontWeight: "600" }}>
                Back
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.btn, { backgroundColor: "#ef4444", opacity: loading ? 0.6 : 1 }]}
              onPress={() => onConfirm(reason)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  Confirm Cancel
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
  },
  box: {
    width: "100%",
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  input: {
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    fontSize: 14,
    minHeight: 80,
    marginBottom: Spacing.two,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onAction,
}: {
  booking: Booking;
  onAction: (type: "accept" | "start" | "complete" | "cancel", id: string) => void;
}) {
  const colors = useTheme();
  const address = formatAddress(booking.serviceAddress);

  return (
    <ThemedView
      type="backgroundElement"
      style={[card.root, booking.isEmergency && { borderLeftColor: "#ef4444", borderLeftWidth: 3 }]}
    >
      {/* ── Top row: status + emergency ── */}
      <View style={card.topRow}>
        <StatusBadge status={booking.status} />
        {booking.isEmergency && (
          <View style={[card.emergBadge]}>
            <ThemedText style={{ color: "#ef4444", fontSize: 12, fontWeight: "700" }}>
              ⚡ Emergency
            </ThemedText>
          </View>
        )}
      </View>

      {/* ── Customer ── */}
      <View style={card.row}>
        <ThemedText type="smallBold">
          {booking.customer?.name ?? "Customer"}
        </ThemedText>
        <ThemedText type="small" style={{ color: colors.text }}>
          {booking.customer?.phone}
        </ThemedText>
      </View>

      {/* ── Category + description ── */}
      {booking.category && (
        <ThemedText type="small" style={{ color: "#3b82f6", fontWeight: "600" }}>
          {booking.category.name}
        </ThemedText>
      )}
      {booking.description && (
        <ThemedText type="small" style={{ color: colors.text }}>
          "{booking.description}"
        </ThemedText>
      )}

      {/* ── Scheduled ── */}
      <ThemedText type="small" style={{ color: colors.text }}>
        🕐 {fmtDate(booking.scheduledAt)}
      </ThemedText>

      {/* ── Address ── */}
      {address && (
        <ThemedText type="small" style={{ color: colors.text }}>
          📍 {address}
        </ThemedText>
      )}

      {/* ── Visiting credit ── */}
      {!!booking.visitingCredit && (
        <ThemedText type="small" style={{ color: "#3b82f6", fontWeight: "600" }}>
          ₹{booking.visitingCredit} visiting charge
        </ThemedText>
      )}

      {/* ── Completed/cancelled meta ── */}
      {booking.status === "completed" && booking.completedAt && (
        <ThemedText type="small" style={{ color: "#16a34a" }}>
          ✓ Completed {fmtDate(booking.completedAt)}
        </ThemedText>
      )}
      {booking.status === "cancelled" && booking.cancellation && (
        <ThemedText type="small" style={{ color: "#ef4444" }}>
          ✗ Cancelled by {booking.cancellation.cancelledBy}
          {booking.cancellation.reason ? ` — "${booking.cancellation.reason}"` : ""}
        </ThemedText>
      )}

      {/* ── Review ── */}
      {booking.review && (
        <View style={[card.reviewBox, { backgroundColor: colors.backgroundSelected }]}>
          <ThemedText type="small" style={{ color: "#f59e0b", fontWeight: "700" }}>
            {"★".repeat(booking.review.rating)}{"☆".repeat(5 - booking.review.rating)}
          </ThemedText>
          {booking.review.comment && (
            <ThemedText type="small" style={{ color: colors.text }}>
              {booking.review.comment}
            </ThemedText>
          )}
        </View>
      )}

      {/* ── Actions ── */}
      {booking.status === "pending" && (
        <View style={card.actions}>
          <TouchableOpacity
            style={[card.btn, { backgroundColor: "#3b82f6" }]}
            onPress={() => onAction("accept", booking._id)}
            activeOpacity={0.8}
          >
            <ThemedText style={card.btnText}>Accept</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[card.btn, { backgroundColor: colors.backgroundSelected }]}
            onPress={() => onAction("cancel", booking._id)}
            activeOpacity={0.8}
          >
            <ThemedText style={[card.btnText, { color: "#ef4444" }]}>Decline</ThemedText>
          </TouchableOpacity>
        </View>
      )}
      {booking.status === "accepted" && (
        <View style={card.actions}>
          <TouchableOpacity
            style={[card.btn, { backgroundColor: "#16a34a" }]}
            onPress={() => onAction("start", booking._id)}
            activeOpacity={0.8}
          >
            <ThemedText style={card.btnText}>Start Job</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[card.btn, { backgroundColor: colors.backgroundSelected }]}
            onPress={() => onAction("cancel", booking._id)}
            activeOpacity={0.8}
          >
            <ThemedText style={[card.btnText, { color: "#ef4444" }]}>Cancel</ThemedText>
          </TouchableOpacity>
        </View>
      )}
      {booking.status === "in_progress" && (
        <TouchableOpacity
          style={[card.btn, { backgroundColor: "#16a34a", alignSelf: "stretch" }]}
          onPress={() => onAction("complete", booking._id)}
          activeOpacity={0.8}
        >
          <ThemedText style={card.btnText}>Mark as Complete</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const card = StyleSheet.create({
  root: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    flexWrap: "wrap",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  emergBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.one,
    backgroundColor: "#fee2e2",
  },
  reviewBox: {
    borderRadius: Spacing.one,
    padding: Spacing.two,
    gap: 4,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const colors = useTheme();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("active");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // booking id being actioned
  const [error, setError] = useState("");

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      // Fetch all statuses relevant to the current tab in parallel
      const statuses = tab === "active" ? ACTIVE_STATUSES : PAST_STATUSES;
      const results = await Promise.all(
        statuses.map((s) => getPartnerBookings({ status: s, limit: 50 }))
      );
      const all = results.flatMap((r) => r.data.bookings);
      // Sort newest scheduled first for active, newest completed first for past
      all.sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      );
      setBookings(all);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not load bookings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll(true);
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (type: "accept" | "start" | "complete" | "cancel", id: string) => {
      if (type === "cancel") {
        setCancelTarget(id);
        return;
      }
      setActionLoading(id);
      try {
        if (type === "accept")   await acceptBooking(id);
        if (type === "start")    await startBooking(id);
        if (type === "complete") await completeBooking(id);
        await fetchAll(true);
      } catch (err: any) {
        Alert.alert(
          "Action failed",
          err?.response?.data?.message ?? "Something went wrong."
        );
      } finally {
        setActionLoading(null);
      }
    },
    [fetchAll]
  );

  const handleCancel = useCallback(
    async (reason: string) => {
      if (!cancelTarget) return;
      setCancelLoading(true);
      try {
        await cancelBooking(cancelTarget, reason || undefined);
        setCancelTarget(null);
        await fetchAll(true);
      } catch (err: any) {
        Alert.alert(
          "Cancel failed",
          err?.response?.data?.message ?? "Something went wrong."
        );
      } finally {
        setCancelLoading(false);
      }
    },
    [cancelTarget, fetchAll]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.inner, { maxWidth: MaxContentWidth }]}>

          {/* ── Header ── */}
          <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
              <ThemedText type="small" style={{ color: "#3b82f6" }}>← Back</ThemedText>
            </TouchableOpacity>
            <ThemedText type="subtitle">My Bookings</ThemedText>
            <TouchableOpacity onPress={() => fetchAll(true)} hitSlop={12}>
              <ThemedText type="small" style={{ color: "#3b82f6" }}>Refresh</ThemedText>
            </TouchableOpacity>
          </View>

          {/* ── Tabs ── */}
          <View style={[styles.tabs, { backgroundColor: colors.backgroundElement }]}>
            {(["active", "past"] as Tab[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tab,
                  tab === t && { backgroundColor: "#3b82f6" },
                ]}
                onPress={() => setTab(t)}
                activeOpacity={0.8}
              >
                <ThemedText
                  type="smallBold"
                  style={{ color: tab === t ? "#fff" : colors.text }}
                >
                  {t === "active" ? "Active" : "Past"}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Content ── */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <ThemedText type="small" style={{ color: "#ef4444", textAlign: "center" }}>
                {error}
              </ThemedText>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchAll()}>
                <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Retry</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {bookings.length === 0 ? (
                <View style={styles.empty}>
                  <ThemedText type="subtitle" style={{ textAlign: "center" }}>
                    {tab === "active" ? "No active bookings" : "No past bookings"}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: colors.text, textAlign: "center" }}>
                    {tab === "active"
                      ? "New requests will appear here."
                      : "Completed and cancelled jobs will appear here."}
                  </ThemedText>
                </View>
              ) : (
                bookings.map((b) => (
                  <View key={b._id} style={{ opacity: actionLoading === b._id ? 0.5 : 1 }}>
                    <BookingCard booking={b} onAction={handleAction} />
                    {actionLoading === b._id && (
                      <ActivityIndicator
                        style={StyleSheet.absoluteFillObject}
                        color="#3b82f6"
                      />
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      {/* ── Cancel modal ── */}
      <CancelModal
        visible={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelLoading}
      />
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: "center" },
  inner: { flex: 1, width: "100%" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  tabs: {
    flexDirection: "row",
    margin: Spacing.three,
    borderRadius: Spacing.two,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: Spacing.two - 2,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    padding: Spacing.four,
  },
  empty: {
    alignItems: "center",
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
  retryBtn: {
    height: 44,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
});
