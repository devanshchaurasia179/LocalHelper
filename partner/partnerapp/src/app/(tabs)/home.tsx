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

// ─── Completion Code Modal ────────────────────────────────────────────────────

// We need to expose imperative controls to the parent. Use a ref-based approach
// via a wrapper that exposes showSuccess / showError.
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
  controlRef: React.RefObject<CompletionCodeModalHandle>;
}) {
  const [digits, setDigits]       = useState(["", "", "", ""]);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const inputs = [
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
  ];
  const slideAnim      = useRef(new Animated.Value(60)).current;
  const fadeAnim       = useRef(new Animated.Value(0)).current;
  const shakeAnim      = useRef(new Animated.Value(0)).current;
  const successScale   = useRef(new Animated.Value(0.7)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Expose imperative API
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

          {/* ── Success overlay (sits on top of the sheet content) ── */}
          {succeeded && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                modalStyles.successOverlay,
                { opacity: successOpacity },
              ]}
            >
              <Animated.View style={{ transform: [{ scale: successScale }], alignItems: "center" }}>
                <View style={modalStyles.successIconWrap}>
                  <Ionicons name="checkmark-circle" size={72} color={colors.success} />
                </View>
                <Text style={modalStyles.successTitle}>Job Complete!</Text>
                <Text style={modalStyles.successSub}>
                  The booking has been marked as done.
                </Text>
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

          {/* OTP boxes — shake on wrong code */}
          <Animated.View
            style={[modalStyles.otpRow, { transform: [{ translateX: shakeAnim }] }]}
          >
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

          {/* Inline error banner */}
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
  overlay:            { flex: 1, justifyContent: "flex-end" },
  backdrop:           { backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: spacing.sm,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14, shadowRadius: 16, elevation: 24,
    overflow: "hidden",
  },
  handle:             { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, marginBottom: spacing.lg },
  iconWrap:           { width: 64, height: 64, borderRadius: 32, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title:              { fontFamily: fonts.oswaldBold, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle:           { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19, marginBottom: spacing.lg + 4, paddingHorizontal: spacing.sm },
  otpRow:             { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  otpBox:             { width: 62, height: 72, borderRadius: radii.md, borderWidth: 2, borderColor: "#D1D5DB", backgroundColor: colors.surface, textAlign: "center", fontFamily: fonts.oswaldBold, fontSize: 32, color: colors.textPrimary },
  otpBoxFilled:       { borderColor: colors.primary, backgroundColor: "#ECFDF5", color: colors.primary },
  otpBoxError:        { borderColor: colors.error, backgroundColor: colors.errorLight, color: colors.error },
  errorBanner:        { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.errorLight, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8, marginBottom: spacing.md, alignSelf: "stretch" },
  errorBannerText:    { fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.errorDark, flex: 1 },
  errorBannerPlaceholder: { height: 36 + spacing.md },
  actions:            { width: "100%", gap: spacing.sm },
  confirmBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 14 },
  confirmBtnDisabled: { backgroundColor: "#9CA3AF" },
  confirmBtnText:     { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.white },
  cancelModalBtn:     { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  cancelModalBtnText: { fontFamily: fonts.jakartaMedium, fontSize: 14, color: colors.textSecondary },
  // Success overlay
  successOverlay: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center",
    zIndex: 10,
  },
  successIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.successLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  successTitle: { fontFamily: fonts.oswaldBold, fontSize: 26, color: colors.textPrimary, marginBottom: spacing.xs },
  successSub:   { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});

// ─── Live Booking Card ────────────────────────────────────────────────────────
// Shown on the home screen for all non-terminal bookings.
// Supports: pending (accept/decline), accepted (start/cancel), in_progress (complete w/ OTP)

const STATUS_META: Record<
  "pending" | "accepted" | "in_progress",
  { label: string; accent: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending:     { label: "Awaiting acceptance", accent: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", icon: "time-outline"      },
  accepted:    { label: "Accepted",             accent: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", icon: "checkmark-circle-outline" },
  in_progress: { label: "In Progress",          accent: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", icon: "construct-outline" },
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
  const meta   = STATUS_META[status];

  const scheduledDate = new Date(booking.scheduledAt);
  const dateStr = scheduledDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const timeStr = scheduledDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // Subtle pulse for pending cards
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (status !== "pending") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.97, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
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
      {/* Left accent strip */}
      <View style={[liveStyles.strip, { backgroundColor: meta.accent }]} />

      <View style={liveStyles.body}>
        {/* ── Row 1: status pill + emergency + credit ── */}
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

        {/* ── Row 2: customer + category ── */}
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

        {/* ── Row 3: schedule + location ── */}
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

        {/* ── Description ── */}
        {booking.description ? (
          <Text style={liveStyles.description} numberOfLines={2}>{booking.description}</Text>
        ) : null}

        {/* ── Actions ── */}
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
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardPending: { backgroundColor: "#f0fdf8" },
  strip:       { width: 4 },
  body:        { flex: 1, padding: spacing.md, gap: spacing.sm },
  topRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topRight:    { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  statusPill:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, borderWidth: 1 },
  statusPillText: { fontFamily: fonts.jakartaSemiBold, fontSize: 10 },
  emergencyChip:  { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.errorLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm },
  emergencyText:  { fontFamily: fonts.jakartaMedium, fontSize: 10, color: colors.error },
  creditChip:     { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.successLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm },
  creditText:     { fontFamily: fonts.jakartaSemiBold, fontSize: 11, color: colors.success },
  customerRow:    { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar:         { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  customerName:   { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.textPrimary },
  categoryText:   { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  metaRow:        { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  metaChip:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm },
  metaText:       { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary },
  description:    { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  actionRow:      { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  btn:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, flex: 1 },
  btnAccept:      { backgroundColor: colors.primary },
  btnDecline:     { backgroundColor: colors.error },
  btnStart:       { backgroundColor: "#6366F1" },
  btnComplete:    { backgroundColor: colors.success },
  btnText:        { fontFamily: fonts.jakartaSemiBold, fontSize: 13, color: colors.white },
});

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { partner } = useAuth();
  const { data } = usePartnerStatus();
  const router = useRouter();

  // ── Recent conversations ──────────────────────────────────────────────────
  const { conversations, refresh: refreshConversations } = useConversations();
  const recentConvs = conversations.slice(0, 3);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadByPartner ?? 0), 0);

  // Listen to socket new_message to refresh the list in real time
  useEffect(() => {
    let mounted = true;
    connectChatSocket()
      .then((socket) => {
        if (!mounted) return;
        socket.on("new_message", () => {
          if (mounted) refreshConversations();
        });
      })
      .catch(() => {/* ignore */});

    return () => {
      mounted = false;
      const socket = getChatSocket();
      if (socket) socket.off("new_message");
    };
  }, [refreshConversations]);

  const { data: serviceData } = useServiceStatus();
  const toggleOnlineMutation  = useToggleOnline();
  const { data: dashboardStats } = useDashboardStats();

  const { data: pendingData } = usePendingBookings();
  const { data: activeData  } = useActiveBookings();

  const acceptMutation   = useAcceptBooking();
  const startMutation    = useStartBooking();
  const completeMutation = useCompleteBooking();
  const cancelMutation   = useCancelBooking();

  // OTP modal state
  const [codeModalVisible,  setCodeModalVisible]  = useState(false);
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const modalControlRef = useRef<CompletionCodeModalHandle>(null);

  const pendingBookings: Booking[] = pendingData?.bookings ?? [];
  const activeBookings:  Booking[] = (activeData as any)?.bookings ?? [];

  // Merge: pending first, then accepted/in_progress
  const liveBookings: Booking[] = [...pendingBookings, ...activeBookings];
  const liveCount = liveBookings.length;

  const isOnline = serviceData?.isOnline ?? false;
  const name     = data?.name ?? partner?.fullName ?? "Partner";
  const greeting = getGreeting();

  const todayBookings = dashboardStats?.todayBookings ?? pendingBookings.length;
  const totalEarnings = dashboardStats?.totalEarnings ?? 0;
  const averageRating = dashboardStats?.averageRating ?? 0;

  const handleViewAllBookings = useCallback(() => {
    router.replace("/(tabs)/bookings" as any);
  }, [router]);

  const handleToggleOnline = useCallback(() => {
    toggleOnlineMutation.mutate(!isOnline);
  }, [isOnline, toggleOnlineMutation]);

  // Complete flow
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

  const isActioning =
    acceptMutation.isPending ||
    startMutation.isPending  ||
    cancelMutation.isPending;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{name}</Text>
          </View>
          <Pressable style={styles.notificationBtn} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
            {liveCount > 0 && <View style={styles.notifDot} />}
          </Pressable>
        </View>

        {/* ── Online toggle card ── */}
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

        {/* ── Live bookings feed ── */}
        {liveCount > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
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

        {/* ── Recent Messages ── */}
        {recentConvs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Recent Messages</Text>
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
            {recentConvs.map((conv) => (
              <RecentMessageRow
                key={conv._id}
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
            ))}
          </View>
        )}

        {/* ── Today's Overview ── */}
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <View style={styles.statsRow}>
          <StatCard icon="calendar"  iconColor="#6366F1" iconBg="#EEF2FF"  label="Bookings" value={String(todayBookings)} />
          <StatCard icon="cash"      iconColor="#10B981" iconBg="#ECFDF5"  label="Earnings" value={`₹${totalEarnings}`} />
          <StatCard icon="star"      iconColor="#F59E0B" iconBg="#FFFBEB"  label="Rating"   value={averageRating > 0 ? averageRating.toFixed(1) : "--"} />
        </View>

        {/* ── Quick Actions ── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionCard icon="time-outline"          label="Availability" color="#6366F1" />
          <ActionCard icon="pricetag-outline"      label="My Services"  color="#10B981" />
          <ActionCard icon="document-text-outline" label="Documents"    color="#F59E0B" />
          <ActionCard icon="help-circle-outline"   label="Support"      color="#EF4444" />
        </View>

        {/* ── Empty state (no live bookings) ── */}
        {liveCount === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="folder-open-outline" size={40} color={colors.navInactive} />
            <Text style={styles.emptyText}>No active bookings</Text>
            <Text style={styles.emptySubtext}>New booking requests will appear here</Text>
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

// ─── Recent Message Row ───────────────────────────────────────────────────────

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return d.toLocaleDateString("en-IN", { weekday: "short" });
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
      {/* Avatar */}
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
      {/* Content */}
      <View style={styles.msgContent}>
        <View style={styles.msgTop}>
          <Text style={[styles.msgName, hasUnread && styles.msgNameBold]} numberOfLines={1}>{name}</Text>
          <Text style={styles.msgTime}>{formatTime(conv.lastMessage?.sentAt ?? null)}</Text>
        </View>
        <Text
          style={[styles.msgPreview, hasUnread && styles.msgPreviewBold]}
          numberOfLines={1}
        >
          {isFromMe ? `You: ${lastText}` : lastText}
        </Text>
      </View>
      {/* Unread badge */}
      {hasUnread && (
        <View style={styles.msgBadge}>
          <Text style={styles.msgBadgeText}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

function StatCard({
  icon, iconColor, iconBg, label, value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string; iconBg: string; label: string; value: string;
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
  icon, label, color,
}: {
  icon: keyof typeof Ionicons.glyphMap; label: string; color: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  greeting:        { fontFamily: fonts.jostRegular,   fontSize: 14, color: colors.textSecondary },
  name:            { fontFamily: fonts.oswaldBold,    fontSize: 26, color: colors.textPrimary, marginTop: 2 },
  notificationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  notifDot:        { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, borderWidth: 2, borderColor: colors.surface },

  statusCard:        { backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.lg },
  statusCardOffline: { backgroundColor: "#4B5563" },
  statusCardContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusRow:         { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 },
  statusDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4ADE80" },
  statusDotOffline:  { backgroundColor: "#9CA3AF" },
  statusText:        { fontFamily: fonts.jakartaSemiBold, fontSize: 16, color: colors.white },
  statusSub:         { fontFamily: fonts.jostRegular,    fontSize: 13, color: "rgba(255,255,255,0.7)", marginLeft: 18 },
  toggleWrap:        { minWidth: 51, alignItems: "center", justifyContent: "center" },

  section:       { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle:  { fontFamily: fonts.jakartaSemiBold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md },
  countBadge:    { backgroundColor: colors.error, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  countBadgeText:{ fontFamily: fonts.jakartaSemiBold, fontSize: 11, color: colors.white },
  viewAllText:   { fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.primary },

  statsRow:    { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  statCard:    { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, alignItems: "center" },
  statIconWrap:{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  statValue:   { fontFamily: fonts.oswaldSemiBold, fontSize: 20, color: colors.textPrimary },
  statLabel:   { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  actionsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  actionCard:    { width: "48%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, alignItems: "center", gap: spacing.sm },
  actionIconWrap:{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  actionLabel:   { fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.textPrimary },

  emptyCard:    { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, alignItems: "center", justifyContent: "center" },
  emptyText:    { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.textPrimary, marginTop: spacing.md },
  emptySubtext: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, textAlign: "center" },

  // ── Recent message row styles ────────────────────────────────────────────
  msgRow:              { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.md, gap: spacing.md, backgroundColor: colors.background },
  msgAvatarWrap:       { position: "relative" },
  msgAvatar:           { width: 44, height: 44, borderRadius: 22 },
  msgAvatarFallback:   { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  msgAvatarInitials:   { fontFamily: fonts.jakartaBold, fontSize: 15, color: colors.white },
  msgUnreadDot:        { position: "absolute", top: 0, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.error, borderWidth: 2, borderColor: colors.background },
  msgContent:          { flex: 1, gap: 2 },
  msgTop:              { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  msgName:             { fontFamily: fonts.jakartaMedium, fontSize: 14, color: colors.textPrimary, flex: 1 },
  msgNameBold:         { fontFamily: fonts.jakartaBold },
  msgTime:             { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, marginLeft: 4 },
  msgPreview:          { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary },
  msgPreviewBold:      { fontFamily: fonts.jostMedium, color: colors.textPrimary },
  msgBadge:            { backgroundColor: colors.error, borderRadius: radii.pill, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  msgBadgeText:        { fontFamily: fonts.jakartaBold, fontSize: 11, color: colors.white },
});
