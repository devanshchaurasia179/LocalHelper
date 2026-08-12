import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SectionList,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "recent" | "history";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWithin24h(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDate(bookings: Booking[]): { title: string; data: Booking[] }[] {
  const map = new Map<string, Booking[]>();
  const sorted = [...bookings].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
  );
  for (const b of sorted) {
    const label = getDateLabel(b.scheduledAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(b);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

const STATUS_CONFIG = {
  pending:     { label: "New Request",  accent: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", icon: "time-outline"               as const },
  accepted:    { label: "Accepted",     accent: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", icon: "checkmark-circle-outline"   as const },
  in_progress: { label: "In Progress",  accent: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", icon: "construct-outline"          as const },
  completed:   { label: "Completed",    accent: "#10B981", bg: "#ECFDF5", border: "#A7F3D0", icon: "checkmark-done-circle-outline" as const },
  cancelled:   { label: "Cancelled",    accent: "#EF4444", bg: "#FEF2F2", border: "#FECACA", icon: "close-circle-outline"       as const },
};

// ─── Completion Code Modal ────────────────────────────────────────────────────

type CompletionCodeModalHandle = {
  showError: (msg: string) => void;
  showSuccess: (onDone: () => void) => void;
};

function CompletionCodeModalControlled({
  visible, onClose, onConfirm, isLoading, controlRef,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (code: string) => void;
  isLoading: boolean;
  controlRef: React.RefObject<CompletionCodeModalHandle>;
}) {
  const [digits, setDigits]       = useState(["", "", "", ""]);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const inputs = [
    useRef<TextInput>(null), useRef<TextInput>(null),
    useRef<TextInput>(null), useRef<TextInput>(null),
  ];
  const slideAnim      = useRef(new Animated.Value(60)).current;
  const fadeAnim       = useRef(new Animated.Value(0)).current;
  const shakeAnim      = useRef(new Animated.Value(0)).current;
  const successScale   = useRef(new Animated.Value(0.7)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  React.useImperativeHandle(controlRef, () => ({
    showError: (msg: string) => {
      setErrorMsg(msg);
      setDigits(["", "", "", ""]);
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 40, useNativeDriver: true }),
      ]).start(() => setTimeout(() => inputs[0].current?.focus(), 50));
    },
    showSuccess: (onDone: () => void) => {
      setSucceeded(true);
      successScale.setValue(0.7);
      successOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(successScale,   { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 120 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start(() => setTimeout(onDone, 1500));
    },
  }));

  useEffect(() => {
    if (visible) {
      setDigits(["", "", "", ""]);
      setErrorMsg(null);
      setSucceeded(false);
      slideAnim.setValue(60);
      fadeAnim.setValue(0);
      successScale.setValue(0.7);
      successOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => setTimeout(() => inputs[0].current?.focus(), 50));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (value: string, index: number) => {
    setErrorMsg(null);
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 3) inputs[index + 1].current?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0)
      inputs[index - 1].current?.focus();
  };

  const code = digits.join("");
  const isComplete = code.length === 4;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={modalStyles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Animated.View style={[StyleSheet.absoluteFill, modalStyles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={!succeeded ? onClose : undefined} />
        </Animated.View>
        <Animated.View style={[modalStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {succeeded && (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, modalStyles.successOverlay, { opacity: successOpacity }]}>
              <Animated.View style={{ transform: [{ scale: successScale }], alignItems: "center" }}>
                <View style={modalStyles.successIconWrap}>
                  <Ionicons name="checkmark-circle" size={72} color={colors.success} />
                </View>
                <Text style={modalStyles.successTitle}>Job Complete!</Text>
                <Text style={modalStyles.successSub}>The booking has been marked as done.</Text>
              </Animated.View>
            </Animated.View>
          )}
          <View style={modalStyles.handle} />
          <View style={modalStyles.iconWrap}>
            <Ionicons name="keypad" size={28} color={colors.primary} />
          </View>
          <Text style={modalStyles.title}>Enter Completion Code</Text>
          <Text style={modalStyles.subtitle}>
            Ask the customer for their 4-digit code and enter it below to complete the job.
          </Text>
          <Animated.View style={[modalStyles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {digits.map((d, i) => (
              <TextInput
                key={i} ref={inputs[i]}
                style={[modalStyles.otpBox, d !== "" && !errorMsg && modalStyles.otpBoxFilled, errorMsg != null && modalStyles.otpBoxError]}
                value={d} onChangeText={(v) => handleChange(v, i)} onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad" maxLength={1} selectTextOnFocus accessibilityLabel={`Digit ${i + 1}`}
              />
            ))}
          </Animated.View>
          {errorMsg != null ? (
            <View style={modalStyles.errorBanner}>
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={modalStyles.errorBannerText}>{errorMsg}</Text>
            </View>
          ) : <View style={modalStyles.errorBannerPlaceholder} />}
          <View style={modalStyles.actions}>
            <Pressable style={[modalStyles.confirmBtn, !isComplete && modalStyles.confirmBtnDisabled]} onPress={() => isComplete && onConfirm(code)} disabled={!isComplete || isLoading}>
              {isLoading ? <ActivityIndicator size="small" color={colors.white} /> : (
                <><Ionicons name="checkmark-done" size={18} color={colors.white} /><Text style={modalStyles.confirmBtnText}>Complete Job</Text></>
              )}
            </Pressable>
            <Pressable style={modalStyles.cancelBtn} onPress={onClose} disabled={isLoading}>
              <Text style={modalStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay:                { flex: 1, justifyContent: "flex-end" },
  backdrop:               { backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:                  { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: spacing.sm, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 24, overflow: "hidden" },
  handle:                 { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, marginBottom: spacing.lg },
  iconWrap:               { width: 64, height: 64, borderRadius: 32, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title:                  { fontFamily: fonts.oswaldBold, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle:               { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19, marginBottom: spacing.lg + 4, paddingHorizontal: spacing.sm },
  otpRow:                 { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  otpBox:                 { width: 62, height: 72, borderRadius: radii.md, borderWidth: 2, borderColor: "#D1D5DB", backgroundColor: colors.surface, textAlign: "center", fontFamily: fonts.oswaldBold, fontSize: 32, color: colors.textPrimary },
  otpBoxFilled:           { borderColor: colors.primary, backgroundColor: "#ECFDF5", color: colors.primary },
  otpBoxError:            { borderColor: colors.error, backgroundColor: colors.errorLight, color: colors.error },
  errorBanner:            { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.errorLight, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8, marginBottom: spacing.md, alignSelf: "stretch" },
  errorBannerText:        { fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.errorDark, flex: 1 },
  errorBannerPlaceholder: { height: 36 + spacing.md },
  actions:                { width: "100%", gap: spacing.sm },
  confirmBtn:             { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 14 },
  confirmBtnDisabled:     { backgroundColor: "#9CA3AF" },
  confirmBtnText:         { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.white },
  cancelBtn:              { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  cancelBtnText:          { fontFamily: fonts.jakartaMedium, fontSize: 14, color: colors.textSecondary },
  successOverlay:         { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", zIndex: 10 },
  successIconWrap:        { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.successLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  successTitle:           { fontFamily: fonts.oswaldBold, fontSize: 26, color: colors.textPrimary, marginBottom: spacing.xs },
  successSub:             { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const [viewMode, setViewMode]   = useState<ViewMode>("recent");
  const [refreshing, setRefreshing] = useState(false);

  const [codeModalVisible,  setCodeModalVisible]  = useState(false);
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const modalControlRef = React.useRef<CompletionCodeModalHandle>(null);

  // Always fetch both so counts are live
  const pendingQuery   = usePendingBookings();
  const activeQuery    = useActiveBookings();
  const completedQuery = usePartnerBookings("completed");
  const cancelledQuery = usePartnerBookings("cancelled");

  const acceptMutation   = useAcceptBooking();
  const startMutation    = useStartBooking();
  const completeMutation = useCompleteBooking();
  const cancelMutation   = useCancelBooking();

  // ── Derived data ─────────────────────────────────────────────────────────

  const pendingBookings: Booking[] = pendingQuery.data?.bookings ?? [];
  const activeBookings:  Booking[] = (activeQuery.data as any)?.bookings ?? [];
  const completedBookings: Booking[] = completedQuery.data?.bookings ?? [];
  const cancelledBookings: Booking[] = cancelledQuery.data?.bookings ?? [];

  // Recent = pending + active (all within 24h or still actionable)
  const recentBookings = useMemo(() => {
    const live = [...pendingBookings, ...activeBookings];
    // also include completed/cancelled from last 24h
    const recent24h = [...completedBookings, ...cancelledBookings].filter(
      (b) => isWithin24h(b.createdAt)
    );
    return [...live, ...recent24h].sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
  }, [pendingBookings, activeBookings, completedBookings, cancelledBookings]);

  // History = completed + cancelled older than 24h, grouped by date
  const historySections = useMemo(() => {
    const old = [...completedBookings, ...cancelledBookings].filter(
      (b) => !isWithin24h(b.createdAt)
    );
    return groupByDate(old);
  }, [completedBookings, cancelledBookings]);

  const liveCount  = pendingBookings.length + activeBookings.length;
  const isLoading  =
    (viewMode === "recent" && (pendingQuery.isLoading || activeQuery.isLoading)) ||
    (viewMode === "history" && (completedQuery.isLoading || cancelledQuery.isLoading));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      pendingQuery.refetch(), activeQuery.refetch(),
      completedQuery.refetch(), cancelledQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [pendingQuery, activeQuery, completedQuery, cancelledQuery]);

  // ── OTP flow ──────────────────────────────────────────────────────────────

  const handleCompletePress = useCallback((bookingId: string) => {
    setPendingCompleteId(bookingId);
    setCodeModalVisible(true);
  }, []);

  const handleCodeConfirm = useCallback((code: string) => {
    if (!pendingCompleteId) return;
    completeMutation.mutate(
      { bookingId: pendingCompleteId, completionCode: code },
      {
        onSuccess: () => {
          modalControlRef.current?.showSuccess(() => {
            setCodeModalVisible(false);
            setPendingCompleteId(null);
          });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Wrong code — check with the customer and try again.";
          modalControlRef.current?.showError(msg);
        },
      }
    );
  }, [pendingCompleteId, completeMutation]);

  const handleModalClose = useCallback(() => {
    if (completeMutation.isPending) return;
    setCodeModalVisible(false);
    setPendingCompleteId(null);
  }, [completeMutation.isPending]);

  const isActioning =
    acceptMutation.isPending || startMutation.isPending || cancelMutation.isPending;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Bookings</Text>
          {liveCount > 0 && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>
                {liveCount} active {liveCount === 1 ? "booking" : "bookings"}
              </Text>
            </View>
          )}
        </View>
        <Pressable style={styles.refreshBtn} onPress={onRefresh} accessibilityLabel="Refresh">
          <Ionicons name="refresh-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* ── View toggle ── */}
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleBtn, viewMode === "recent" && styles.toggleBtnActive]}
          onPress={() => setViewMode("recent")}
        >
          <Ionicons name="flash-outline" size={14} color={viewMode === "recent" ? colors.white : colors.textSecondary} />
          <Text style={[styles.toggleText, viewMode === "recent" && styles.toggleTextActive]}>Recent</Text>
          {liveCount > 0 && (
            <View style={styles.toggleBadge}>
              <Text style={styles.toggleBadgeText}>{liveCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, viewMode === "history" && styles.toggleBtnActive]}
          onPress={() => setViewMode("history")}
        >
          <Ionicons name="time-outline" size={14} color={viewMode === "history" ? colors.white : colors.textSecondary} />
          <Text style={[styles.toggleText, viewMode === "history" && styles.toggleTextActive]}>History</Text>
        </Pressable>
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : viewMode === "recent" ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {recentBookings.length === 0 ? (
            <EmptyState icon="flash-outline" text="No recent bookings" sub="New requests and active jobs appear here" />
          ) : (
            <>
              {/* Sub-label */}
              <Text style={styles.sectionHint}>Pending, active & last 24 hours</Text>
              {recentBookings.map((b) => (
                <BookingCard
                  key={b._id} booking={b}
                  onAccept={() => acceptMutation.mutate(b._id)}
                  onStart={() => startMutation.mutate(b._id)}
                  onComplete={() => handleCompletePress(b._id)}
                  onCancel={() => cancelMutation.mutate({ bookingId: b._id })}
                  isActioning={isActioning}
                />
              ))}
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <SectionList
          sections={historySections}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.dateHeader}>
              <Text style={styles.dateHeaderText}>{section.title}</Text>
              <View style={styles.dateHeaderLine} />
            </View>
          )}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onAccept={() => {}}
              onStart={() => {}}
              onComplete={() => {}}
              onCancel={() => {}}
              isActioning={false}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="time-outline" text="No booking history" sub="Completed and cancelled bookings appear here" />
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
          stickySectionHeadersEnabled={false}
        />
      )}

      <BottomNav />

      <CompletionCodeModalControlled
        visible={codeModalVisible}
        onClose={handleModalClose}
        onConfirm={handleCodeConfirm}
        isLoading={completeMutation.isPending}
        controlRef={modalControlRef}
      />
    </SafeAreaView>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking, onAccept, onStart, onComplete, onCancel, isActioning,
}: {
  booking: Booking;
  onAccept: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
  isActioning: boolean;
}) {
  const status = booking.status as keyof typeof STATUS_CONFIG;
  const meta   = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  const isPending    = status === "pending";
  const isAccepted   = status === "accepted";
  const isInProgress = status === "in_progress";
  const isTerminal   = status === "completed" || status === "cancelled";

  const scheduledDate = new Date(booking.scheduledAt);
  const dateStr = scheduledDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = scheduledDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // Pulse for pending
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isPending) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.975, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,     duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isPending, pulseAnim]);

  return (
    <Animated.View style={[cardStyles.card, { borderColor: meta.border, transform: [{ scale: pulseAnim }] }, isPending && { backgroundColor: "#f0fdf8" }]}>
      {/* Left accent strip */}
      <View style={[cardStyles.strip, { backgroundColor: meta.accent }]} />

      <View style={cardStyles.body}>
        {/* Row 1: status pill + badges */}
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
            <Ionicons name={meta.icon} size={10} color={meta.accent} />
            <Text style={[cardStyles.statusPillText, { color: meta.accent }]}>{meta.label}</Text>
          </View>
          <View style={cardStyles.topRight}>
            {booking.isEmergency && (
              <View style={cardStyles.emergencyChip}>
                <Ionicons name="flash" size={10} color={colors.error} />
                <Text style={cardStyles.emergencyText}>Urgent</Text>
              </View>
            )}
            {booking.visitingCredit != null && (
              <View style={cardStyles.creditChip}>
                <Ionicons name="cash-outline" size={10} color={colors.success} />
                <Text style={cardStyles.creditText}>₹{booking.visitingCredit}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Row 2: customer */}
        <View style={cardStyles.customerRow}>
          <View style={cardStyles.avatar}>
            <Ionicons name="person" size={15} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={cardStyles.customerName} numberOfLines={1}>
              {booking.customer?.name ?? "Customer"}
            </Text>
            {booking.category?.name && (
              <Text style={cardStyles.categoryText}>{booking.category.name}</Text>
            )}
          </View>
        </View>

        {/* Description */}
        {booking.description ? (
          <Text style={cardStyles.description} numberOfLines={2}>{booking.description}</Text>
        ) : null}

        {/* Row 3: meta chips */}
        <View style={cardStyles.metaRow}>
          <View style={cardStyles.metaChip}>
            <Ionicons name="calendar-outline" size={11} color={colors.textSecondary} />
            <Text style={cardStyles.metaText}>{dateStr} · {timeStr}</Text>
          </View>
          {booking.serviceAddress?.locality && (
            <View style={cardStyles.metaChip}>
              <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
              <Text style={cardStyles.metaText} numberOfLines={1}>{booking.serviceAddress.locality}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {!isTerminal && (
          <View style={cardStyles.actionRow}>
            {isPending && (
              <>
                <Pressable style={[cardStyles.btn, cardStyles.btnAccept]} onPress={onAccept} disabled={isActioning} accessibilityLabel="Accept">
                  <Ionicons name="checkmark" size={13} color={colors.white} />
                  <Text style={cardStyles.btnText}>Accept</Text>
                </Pressable>
                <Pressable style={[cardStyles.btn, cardStyles.btnDecline]} onPress={onCancel} disabled={isActioning} accessibilityLabel="Decline">
                  <Ionicons name="close" size={13} color={colors.white} />
                  <Text style={cardStyles.btnText}>Decline</Text>
                </Pressable>
              </>
            )}
            {isAccepted && (
              <>
                <Pressable style={[cardStyles.btn, cardStyles.btnStart]} onPress={onStart} disabled={isActioning} accessibilityLabel="Start work">
                  <Ionicons name="play" size={12} color={colors.white} />
                  <Text style={cardStyles.btnText}>Start Work</Text>
                </Pressable>
                <Pressable style={[cardStyles.btn, cardStyles.btnDecline]} onPress={onCancel} disabled={isActioning} accessibilityLabel="Cancel">
                  <Ionicons name="close" size={13} color={colors.white} />
                  <Text style={cardStyles.btnText}>Cancel</Text>
                </Pressable>
              </>
            )}
            {isInProgress && (
              <Pressable style={[cardStyles.btn, cardStyles.btnComplete]} onPress={onComplete} disabled={isActioning} accessibilityLabel="Complete">
                <Ionicons name="keypad-outline" size={13} color={colors.white} />
                <Text style={cardStyles.btnText}>Complete — Enter Code</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon, text, sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  sub: string;
}) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

// ─── Card Styles ──────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  strip:          { width: 4 },
  body:           { flex: 1, padding: spacing.md, gap: spacing.sm },
  topRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topRight:       { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  statusPill:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, borderWidth: 1 },
  statusPillText: { fontFamily: fonts.jakartaSemiBold, fontSize: 10 },
  emergencyChip:  { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.errorLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm },
  emergencyText:  { fontFamily: fonts.jakartaMedium, fontSize: 10, color: colors.error },
  creditChip:     { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.successLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm },
  creditText:     { fontFamily: fonts.jakartaSemiBold, fontSize: 10, color: colors.success },
  customerRow:    { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar:         { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  customerName:   { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.textPrimary },
  categoryText:   { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  description:    { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  metaRow:        { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  metaChip:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm },
  metaText:       { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary },
  actionRow:      { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  btn:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, flex: 1 },
  btnAccept:      { backgroundColor: colors.primary },
  btnDecline:     { backgroundColor: colors.error },
  btnStart:       { backgroundColor: "#6366F1" },
  btnComplete:    { backgroundColor: colors.success },
  btnText:        { fontFamily: fonts.jakartaSemiBold, fontSize: 12, color: colors.white },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.background },

  // Header
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pageTitle:    { fontFamily: fonts.oswaldBold, fontSize: 28, color: colors.textPrimary },
  livePill:     { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  liveDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ADE80" },
  livePillText: { fontFamily: fonts.jakartaMedium, fontSize: 12, color: colors.success },
  refreshBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginTop: 2 },

  // Toggle
  toggleRow:          { flexDirection: "row", marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: radii.pill, padding: 4, gap: 4 },
  toggleBtn:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: radii.pill },
  toggleBtnActive:    { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  toggleText:         { fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.textSecondary },
  toggleTextActive:   { color: colors.white },
  toggleBadge:        { backgroundColor: colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  toggleBadgeText:    { fontFamily: fonts.jakartaSemiBold, fontSize: 9, color: colors.white },

  // Content
  scrollContent:  { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  center:         { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionHint:    { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.navInactive, marginBottom: spacing.sm },

  // Date section header
  dateHeader:     { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.md },
  dateHeaderText: { fontFamily: fonts.jakartaSemiBold, fontSize: 13, color: colors.textSecondary, flexShrink: 0 },
  dateHeaderLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },

  // Empty
  emptyWrap:      { paddingTop: 80, alignItems: "center", gap: spacing.sm },
  emptyIconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  emptyText:      { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.textPrimary },
  emptySub:       { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19, paddingHorizontal: spacing.lg },
});
