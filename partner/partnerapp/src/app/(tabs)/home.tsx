import { useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Image,
  RefreshControl,
  Dimensions,
} from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import {
  usePendingBookings,
  useActiveBookings,
  useAcceptBooking,
  useStartBooking,
  useCompleteBooking,
  useCancelBooking,
} from "@/hooks/useBookings";
import { useServiceStatus, useToggleOnline, useDashboardStats } from "@/hooks/useServiceStatus";
import { colors, fonts, spacing, radii } from "@/constants/theme";
import BottomNav from "@/components/navigation/BottomNav";
import type { Booking } from "@/api/booking.api";
import { useConversations } from "@/hooks/useConversations";
import { connectChatSocket, getChatSocket } from "@/services/chat.socket";
import type { Conversation } from "@/api/chat.api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Completion Code Modal ────────────────────────────────────────────────────

type CompletionCodeModalHandle = {
  showError: (msg: string) => void;
  showSuccess: (onDone: () => void) => void;
};

function CompletionCodeModalControlled({
  visible,
  onClose,
  onConfirm,
  isLoading,
  controlRef,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (code: string) => void;
  isLoading: boolean;
  controlRef: React.RefObject<CompletionCodeModalHandle | null>;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const inputs = [
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
  ];
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.7)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  React.useImperativeHandle(controlRef, () => ({
    showError: (msg: string) => {
      setErrorMsg(msg);
      setDigits(["", "", "", ""]);
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start(() => setTimeout(() => inputs[0].current?.focus(), 50));
    },
    showSuccess: (onDone: () => void) => {
      setSucceeded(true);
      successScale.setValue(0.7);
      successOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 120 }),
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
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
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

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0)
      inputs[index - 1].current?.focus();
  };

  const code = digits.join("");
  const isComplete = code.length === 4;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View style={[StyleSheet.absoluteFill, modalStyles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={!succeeded ? onClose : undefined} />
        </Animated.View>

        <Animated.View style={[modalStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {succeeded && (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, modalStyles.successOverlay, { opacity: successOpacity }]}
            >
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
            Ask the customer for their 4-digit code to mark this job complete.
          </Text>

          <Animated.View style={[modalStyles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={inputs[i]}
                style={[
                  modalStyles.otpBox,
                  d !== "" && !errorMsg && modalStyles.otpBoxFilled,
                  errorMsg != null && modalStyles.otpBoxError,
                ]}
                value={d}
                onChangeText={(v) => handleChange(v, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                accessibilityLabel={`Digit ${i + 1}`}
              />
            ))}
          </Animated.View>

          {errorMsg != null ? (
            <View style={modalStyles.errorBanner}>
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={modalStyles.errorBannerText}>{errorMsg}</Text>
            </View>
          ) : (
            <View style={modalStyles.errorBannerPlaceholder} />
          )}

          <View style={modalStyles.actions}>
            <Pressable
              style={[modalStyles.confirmBtn, !isComplete && modalStyles.confirmBtnDisabled]}
              onPress={() => isComplete && onConfirm(code)}
              disabled={!isComplete || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color={colors.white} />
                  <Text style={modalStyles.confirmBtnText}>Complete Job</Text>
                </>
              )}
            </Pressable>
            <Pressable style={modalStyles.cancelModalBtn} onPress={onClose} disabled={isLoading}>
              <Text style={modalStyles.cancelModalBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: spacing.sm,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14, shadowRadius: 16, elevation: 24,
    overflow: "hidden",
  },
  handle: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, marginBottom: spacing.lg },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { fontFamily: fonts.oswaldBold, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19, marginBottom: spacing.lg + 4, paddingHorizontal: spacing.sm },
  otpRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  otpBox: { width: 62, height: 72, borderRadius: radii.md, borderWidth: 2, borderColor: "#D1D5DB", backgroundColor: colors.surface, textAlign: "center", fontFamily: fonts.oswaldBold, fontSize: 32, color: colors.textPrimary },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: "#ECFDF5", color: colors.primary },
  otpBoxError: { borderColor: colors.error, backgroundColor: colors.errorLight, color: colors.error },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.errorLight, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8, marginBottom: spacing.md, alignSelf: "stretch" },
  errorBannerText: { fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.errorDark, flex: 1 },
  errorBannerPlaceholder: { height: 36 + spacing.md },
  actions: { width: "100%", gap: spacing.sm },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 14 },
  confirmBtnDisabled: { backgroundColor: "#9CA3AF" },
  confirmBtnText: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.white },
  cancelModalBtn: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  cancelModalBtnText: { fontFamily: fonts.jakartaMedium, fontSize: 14, color: colors.textSecondary },
  successOverlay: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center", zIndex: 10,
  },
  successIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.successLight,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  successTitle: { fontFamily: fonts.oswaldBold, fontSize: 26, color: colors.textPrimary, marginBottom: spacing.xs },
  successSub: { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});

// ─── Live Booking Card ────────────────────────────────────────────────────────

const BOOKING_STATUS_META: Record<
  "pending" | "accepted" | "in_progress",
  { label: string; accent: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { label: "Awaiting acceptance", accent: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", icon: "time-outline" },
  accepted: { label: "Accepted", accent: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", icon: "checkmark-circle-outline" },
  in_progress: { label: "In Progress", accent: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", icon: "construct-outline" },
};

function LiveBookingCard({
  booking,
  onAccept,
  onDecline,
  onStart,
  onCompletePress,
  isActioning,
}: {
  booking: Booking;
  onAccept: () => void;
  onDecline: () => void;
  onStart: () => void;
  onCompletePress: () => void;
  isActioning: boolean;
}) {
  const status = booking.status as "pending" | "accepted" | "in_progress";
  const meta = BOOKING_STATUS_META[status];

  // Guard: if booking has an unexpected status, don't render
  if (!meta) return null;

  const scheduledDate = new Date(booking.scheduledAt);
  const dateStr = scheduledDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const timeStr = scheduledDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (status !== "pending") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.97, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulseAnim]);

  return (
    <Animated.View
      style={[
        liveStyles.card,
        { borderColor: meta.border, transform: [{ scale: pulseAnim }] },
        status === "pending" && liveStyles.cardPending,
      ]}
    >
      <View style={[liveStyles.strip, { backgroundColor: meta.accent }]} />
      <View style={liveStyles.body}>
        {/* Status + badges */}
        <View style={liveStyles.topRow}>
          <View style={[liveStyles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
            <Ionicons name={meta.icon} size={11} color={meta.accent} />
            <Text style={[liveStyles.statusPillText, { color: meta.accent }]}>{meta.label}</Text>
          </View>
          <View style={liveStyles.topRight}>
            {booking.isEmergency && (
              <View style={liveStyles.emergencyChip}>
                <Ionicons name="flash" size={10} color={colors.error} />
                <Text style={liveStyles.emergencyText}>Urgent</Text>
              </View>
            )}
            {booking.visitingCredit != null && (
              <View style={liveStyles.creditChip}>
                <Ionicons name="cash-outline" size={11} color={colors.success} />
                <Text style={liveStyles.creditText}>₹{booking.visitingCredit}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Customer info */}
        <View style={liveStyles.customerRow}>
          <View style={liveStyles.avatar}>
            <Ionicons name="person" size={16} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={liveStyles.customerName} numberOfLines={1}>
              {booking.customer?.name ?? "Customer"}
            </Text>
            {booking.category?.name && (
              <Text style={liveStyles.categoryText}>{booking.category.name}</Text>
            )}
          </View>
        </View>

        {/* Meta chips */}
        <View style={liveStyles.metaRow}>
          <View style={liveStyles.metaChip}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={liveStyles.metaText}>{dateStr} · {timeStr}</Text>
          </View>
          {booking.serviceAddress?.locality ? (
            <View style={liveStyles.metaChip}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={liveStyles.metaText} numberOfLines={1}>
                {booking.serviceAddress.locality}
              </Text>
            </View>
          ) : null}
        </View>

        {booking.description ? (
          <Text style={liveStyles.description} numberOfLines={2}>{booking.description}</Text>
        ) : null}

        {/* Actions */}
        <View style={liveStyles.actionRow}>
          {status === "pending" && (
            <>
              <Pressable
                style={[liveStyles.btn, liveStyles.btnAccept]}
                onPress={onAccept} disabled={isActioning}
                accessibilityLabel="Accept booking"
              >
                <Ionicons name="checkmark" size={14} color={colors.white} />
                <Text style={liveStyles.btnText}>Accept</Text>
              </Pressable>
              <Pressable
                style={[liveStyles.btn, liveStyles.btnDecline]}
                onPress={onDecline} disabled={isActioning}
                accessibilityLabel="Decline booking"
              >
                <Ionicons name="close" size={14} color={colors.white} />
                <Text style={liveStyles.btnText}>Decline</Text>
              </Pressable>
            </>
          )}
          {status === "accepted" && (
            <>
              <Pressable
                style={[liveStyles.btn, liveStyles.btnStart]}
                onPress={onStart} disabled={isActioning}
                accessibilityLabel="Start work"
              >
                <Ionicons name="play" size={13} color={colors.white} />
                <Text style={liveStyles.btnText}>Start Work</Text>
              </Pressable>
              <Pressable
                style={[liveStyles.btn, liveStyles.btnDecline]}
                onPress={onDecline} disabled={isActioning}
                accessibilityLabel="Cancel booking"
              >
                <Ionicons name="close" size={14} color={colors.white} />
                <Text style={liveStyles.btnText}>Cancel</Text>
              </Pressable>
            </>
          )}
          {status === "in_progress" && (
            <Pressable
              style={[liveStyles.btn, liveStyles.btnComplete]}
              onPress={onCompletePress} disabled={isActioning}
              accessibilityLabel="Complete job — enter customer code"
            >
              <Ionicons name="keypad-outline" size={14} color={colors.white} />
              <Text style={liveStyles.btnText}>Complete — Enter Code</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const liveStyles = StyleSheet.create({
  card: {
    flexDirection: "row", backgroundColor: colors.background,
    borderRadius: radii.md, borderWidth: 1.5, marginBottom: spacing.xs,
    overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05,
    shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  cardPending: { backgroundColor: "#f0fdf8" },
  strip: { width: 3 },
  body: { flex: 1, padding: spacing.sm, gap: 6 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill, borderWidth: 1 },
  statusPillText: { fontFamily: fonts.jakartaSemiBold, fontSize: 9 },
  emergencyChip: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.errorLight, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radii.sm },
  emergencyText: { fontFamily: fonts.jakartaMedium, fontSize: 9, color: colors.error },
  creditChip: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.successLight, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radii.sm },
  creditText: { fontFamily: fonts.jakartaSemiBold, fontSize: 10, color: colors.success },
  customerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  customerName: { fontFamily: fonts.jakartaSemiBold, fontSize: 13, color: colors.textPrimary },
  categoryText: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm },
  metaText: { fontFamily: fonts.jostRegular, fontSize: 10, color: colors.textSecondary },
  description: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, lineHeight: 15 },
  actionRow: { flexDirection: "row", gap: spacing.xs, marginTop: 2 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, flex: 1 },
  btnAccept: { backgroundColor: colors.primary },
  btnDecline: { backgroundColor: colors.error },
  btnStart: { backgroundColor: "#6366F1" },
  btnComplete: { backgroundColor: colors.success },
  btnText: { fontFamily: fonts.jakartaSemiBold, fontSize: 12, color: colors.white },
});

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { partner } = useAuth();
  const { data } = usePartnerStatus();
  const router = useRouter();

  // Conversations
  const { conversations, refresh: refreshConversations } = useConversations();
  const recentConvs = conversations.slice(0, 3);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadByPartner ?? 0), 0);

  useEffect(() => {
    let mounted = true;
    connectChatSocket()
      .then((socket) => {
        if (!mounted) return;
        socket.on("new_message", () => {
          if (mounted) refreshConversations();
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
      const socket = getChatSocket();
      if (socket) socket.off("new_message");
    };
  }, [refreshConversations]);

  const { data: serviceData } = useServiceStatus();
  const toggleOnlineMutation = useToggleOnline();
  const { data: dashboardStats, refetch: refetchDashboard } = useDashboardStats();

  const { data: pendingData, refetch: refetchPending } = usePendingBookings();
  const { data: activeData, refetch: refetchActive } = useActiveBookings();

  const acceptMutation = useAcceptBooking();
  const startMutation = useStartBooking();
  const completeMutation = useCompleteBooking();
  const cancelMutation = useCancelBooking();

  // OTP modal
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const modalControlRef = useRef<CompletionCodeModalHandle>(null);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);

  const pendingBookings: Booking[] = pendingData?.bookings ?? [];
  const activeBookings: Booking[] = (activeData as any)?.bookings ?? [];
  const liveBookings: Booking[] = [...pendingBookings, ...activeBookings].filter(
    (b) => b.status === 'pending' || b.status === 'accepted' || b.status === 'in_progress'
  );
  const liveCount = liveBookings.length;

  const isOnline = serviceData?.isOnline ?? false;
  const name = data?.name ?? partner?.fullName ?? "Partner";
  const greeting = getGreeting();

  const todayBookings = dashboardStats?.todayBookings ?? 0;
  const totalEarnings = dashboardStats?.totalEarnings ?? 0;
  const walletBalance = dashboardStats?.walletBalance ?? 0;
  const averageRating = dashboardStats?.averageRating ?? 0;
  const totalReviews = dashboardStats?.totalReviews ?? 0;
  const completedJobs = dashboardStats?.completedJobs ?? 0;

  const handleViewAllBookings = useCallback(() => {
    router.replace("/(tabs)/bookings" as any);
  }, [router]);

  const handleToggleOnline = useCallback(() => {
    toggleOnlineMutation.mutate(!isOnline);
  }, [isOnline, toggleOnlineMutation]);

  const handleCompletePress = useCallback((bookingId: string) => {
    setPendingCompleteId(bookingId);
    setCodeModalVisible(true);
  }, []);

  const handleCodeConfirm = useCallback(
    (code: string) => {
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
    },
    [pendingCompleteId, completeMutation]
  );

  const handleModalClose = useCallback(() => {
    if (completeMutation.isPending) return;
    setCodeModalVisible(false);
    setPendingCompleteId(null);
  }, [completeMutation.isPending]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchPending(), refetchActive(), refetchDashboard(), refreshConversations()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchPending, refetchActive, refetchDashboard, refreshConversations]);

  const isActioning =
    acceptMutation.isPending || startMutation.isPending || cancelMutation.isPending;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
          </View>
          <Pressable
            style={styles.notificationBtn}
            accessibilityLabel="Notifications"
            onPress={() => router.push("/(tabs)/chat" as any)}
          >
            <Ionicons name="chatbubbles-outline" size={22} color={colors.textPrimary} />
            {totalUnread > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{totalUnread > 9 ? "9+" : totalUnread}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Online/Offline Toggle Hero ── */}
        <View style={[styles.heroCard, !isOnline && styles.heroCardOffline]}>
          <View style={styles.heroCardInner}>
            <View style={styles.heroLeft}>
              <View style={styles.heroStatusRow}>
                <View style={[styles.heroDot, !isOnline && styles.heroDotOffline]} />
                <Text style={styles.heroStatusLabel}>
                  {isOnline ? "You're Online" : "You're Offline"}
                </Text>
              </View>
              <Text style={styles.heroSubtext}>
                {isOnline
                  ? "Customers can find and book you"
                  : "Go online to start receiving bookings"}
              </Text>
            </View>
            <View style={styles.heroToggle}>
              {toggleOnlineMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Switch
                  value={isOnline}
                  onValueChange={handleToggleOnline}
                  trackColor={{ false: "rgba(255,255,255,0.25)", true: "rgba(74,222,128,0.5)" }}
                  thumbColor={isOnline ? "#4ADE80" : "#E5E7EB"}
                  ios_backgroundColor="rgba(255,255,255,0.2)"
                  accessibilityLabel={isOnline ? "Go offline" : "Go online"}
                />
              )}
            </View>
          </View>

          {/* Inline stats row within the hero */}
          {isOnline && (
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{todayBookings}</Text>
                <Text style={styles.heroStatLabel}>Today</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>₹{walletBalance}</Text>
                <Text style={styles.heroStatLabel}>Balance</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{averageRating > 0 ? averageRating.toFixed(1) : "--"}</Text>
                <Text style={styles.heroStatLabel}>Rating</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Live Bookings Feed ── */}
        {liveCount > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Live Bookings</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{liveCount}</Text>
                </View>
              </View>
              <Pressable onPress={handleViewAllBookings} hitSlop={8}>
                <Text style={styles.viewAllText}>View All</Text>
              </Pressable>
            </View>

            {liveBookings.map((booking) => (
              <LiveBookingCard
                key={booking._id}
                booking={booking}
                onAccept={() => acceptMutation.mutate(booking._id)}
                onDecline={() => cancelMutation.mutate({ bookingId: booking._id })}
                onStart={() => startMutation.mutate(booking._id)}
                onCompletePress={() => handleCompletePress(booking._id)}
                isActioning={isActioning}
              />
            ))}
          </View>
        )}

        {/* ── Performance Overview ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.performanceGrid}>
            <View style={styles.perfCard}>
              <View style={[styles.perfIconWrap, { backgroundColor: "#EEF2FF" }]}>
                <Ionicons name="briefcase" size={18} color="#6366F1" />
              </View>
              <Text style={styles.perfValue}>{completedJobs}</Text>
              <Text style={styles.perfLabel}>Jobs Done</Text>
            </View>
            <View style={styles.perfCard}>
              <View style={[styles.perfIconWrap, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons name="cash" size={18} color={colors.success} />
              </View>
              <Text style={styles.perfValue}>₹{totalEarnings}</Text>
              <Text style={styles.perfLabel}>Total Earned</Text>
            </View>
            <View style={styles.perfCard}>
              <View style={[styles.perfIconWrap, { backgroundColor: "#FFFBEB" }]}>
                <Ionicons name="star" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.perfValue}>{averageRating > 0 ? averageRating.toFixed(1) : "--"}</Text>
              <Text style={styles.perfLabel}>{totalReviews} Reviews</Text>
            </View>
            <View style={styles.perfCard}>
              <View style={[styles.perfIconWrap, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons name="calendar" size={18} color="#EF4444" />
              </View>
              <Text style={styles.perfValue}>{todayBookings}</Text>
              <Text style={styles.perfLabel}>Today</Text>
            </View>
          </View>
        </View>

        {/* ── Recent Messages ── */}
        {recentConvs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Messages</Text>
                {totalUnread > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{totalUnread > 99 ? "99+" : totalUnread}</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={() => router.replace("/(tabs)/chat" as any)} hitSlop={8}>
                <Text style={styles.viewAllText}>View All</Text>
              </Pressable>
            </View>
            <View style={styles.messagesCard}>
              {recentConvs.map((conv, idx) => (
                <React.Fragment key={conv._id}>
                  <RecentMessageRow
                    conv={conv}
                    onPress={() => router.push({
                      pathname: "/(tabs)/chat/[conversationId]" as any,
                      params: {
                        conversationId: conv._id,
                        customerName: conv.customer?.fullName ?? conv.customer?.name ?? "Customer",
                        customerPhoto: conv.customer?.profilePhoto ?? "",
                      },
                    })}
                  />
                  {idx < recentConvs.length - 1 && <View style={styles.msgDivider} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

        {/* ── Empty state (no live bookings) ── */}
        {liveCount === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="hourglass-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No active bookings</Text>
            <Text style={styles.emptySubtext}>
              {isOnline
                ? "You're all set! New booking requests will appear here."
                : "Go online to start receiving booking requests from customers."}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

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

// ─── Sub-Components ───────────────────────────────────────────────────────────

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-IN", { weekday: "short" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getInitials(name?: string): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function RecentMessageRow({ conv, onPress }: { conv: Conversation; onPress: () => void }) {
  const customer = conv.customer;
  const name = customer?.fullName ?? customer?.name ?? "Customer";
  const lastText = conv.lastMessage?.text || (conv.lastMessage?.senderType ? "📷 Image" : "No messages yet");
  const isFromMe = conv.lastMessage?.senderType === "partner";
  const unread = conv.unreadByPartner ?? 0;
  const hasUnread = unread > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.msgRow, pressed && { backgroundColor: colors.surface }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${name}`}
    >
      <View style={styles.msgAvatarWrap}>
        {customer?.profilePhoto ? (
          <Image source={{ uri: customer.profilePhoto }} style={styles.msgAvatar} />
        ) : (
          <View style={[styles.msgAvatar, styles.msgAvatarFallback]}>
            <Text style={styles.msgAvatarInitials}>{getInitials(name)}</Text>
          </View>
        )}
        {hasUnread && <View style={styles.msgUnreadDot} />}
      </View>
      <View style={styles.msgContent}>
        <View style={styles.msgTop}>
          <Text style={[styles.msgName, hasUnread && styles.msgNameBold]} numberOfLines={1}>{name}</Text>
          <Text style={styles.msgTime}>{formatTime(conv.lastMessage?.sentAt ?? null)}</Text>
        </View>
        <Text style={[styles.msgPreview, hasUnread && styles.msgPreviewBold]} numberOfLines={1}>
          {isFromMe ? `You: ${lastText}` : lastText}
        </Text>
      </View>
      {hasUnread && (
        <View style={styles.msgBadge}>
          <Text style={styles.msgBadgeText}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  headerLeft: { flex: 1 },
  greeting: { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary },
  name: { fontFamily: fonts.oswaldBold, fontSize: 28, color: colors.textPrimary, marginTop: 2 },
  notificationBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#F3F4F6",
  },
  notifBadge: {
    position: "absolute", top: 6, right: 6,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.error, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, borderWidth: 2, borderColor: colors.background,
  },
  notifBadgeText: { fontFamily: fonts.jakartaBold, fontSize: 9, color: colors.white },

  // Hero Card (Online Toggle)
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg, padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  heroCardOffline: { backgroundColor: "#374151" },
  heroCardInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLeft: { flex: 1 },
  heroStatusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 },
  heroDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4ADE80" },
  heroDotOffline: { backgroundColor: "#6B7280" },
  heroStatusLabel: { fontFamily: fonts.jakartaSemiBold, fontSize: 17, color: colors.white },
  heroSubtext: { fontFamily: fonts.jostRegular, fontSize: 13, color: "rgba(255,255,255,0.7)", marginLeft: 18 },
  heroToggle: { minWidth: 51, alignItems: "center", justifyContent: "center" },
  heroStatsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    marginTop: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)",
  },
  heroStatItem: { alignItems: "center" },
  heroStatValue: { fontFamily: fonts.oswaldSemiBold, fontSize: 20, color: colors.white },
  heroStatLabel: { fontFamily: fonts.jostRegular, fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.15)" },

  // Sections
  section: { marginBottom: spacing.lg },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 16, color: colors.textPrimary },
  countBadge: { backgroundColor: colors.error, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  countBadgeText: { fontFamily: fonts.jakartaSemiBold, fontSize: 11, color: colors.white },
  viewAllText: { fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.primary },

  // Performance Grid
  performanceGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  perfCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2 - 0.5,
    backgroundColor: colors.surface, borderRadius: radii.md,
    padding: spacing.md, gap: spacing.xs,
  },
  perfIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  perfValue: { fontFamily: fonts.oswaldSemiBold, fontSize: 22, color: colors.textPrimary, marginTop: spacing.xs },
  perfLabel: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary },

  // Messages card wrapper
  messagesCard: {
    backgroundColor: colors.surface, borderRadius: radii.md,
    overflow: "hidden",
  },
  msgDivider: { height: 1, backgroundColor: "#F3F4F6", marginHorizontal: spacing.md },

  // Empty State
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    paddingVertical: spacing.xl + spacing.sm, paddingHorizontal: spacing.lg,
    alignItems: "center", justifyContent: "center",
  },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.xs },
  emptySubtext: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19, maxWidth: 260 },

  // Message row styles
  msgRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, gap: spacing.md },
  msgAvatarWrap: { position: "relative" },
  msgAvatar: { width: 44, height: 44, borderRadius: 22 },
  msgAvatarFallback: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  msgAvatarInitials: { fontFamily: fonts.jakartaBold, fontSize: 15, color: colors.white },
  msgUnreadDot: { position: "absolute", top: 0, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.error, borderWidth: 2, borderColor: colors.surface },
  msgContent: { flex: 1, gap: 2 },
  msgTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  msgName: { fontFamily: fonts.jakartaMedium, fontSize: 14, color: colors.textPrimary, flex: 1 },
  msgNameBold: { fontFamily: fonts.jakartaBold },
  msgTime: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, marginLeft: 4 },
  msgPreview: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary },
  msgPreviewBold: { fontFamily: fonts.jostMedium, color: colors.textPrimary },
  msgBadge: { backgroundColor: colors.error, borderRadius: radii.pill, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  msgBadgeText: { fontFamily: fonts.jakartaBold, fontSize: 11, color: colors.white },
});
