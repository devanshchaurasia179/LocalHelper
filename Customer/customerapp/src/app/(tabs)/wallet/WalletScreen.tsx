import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  FlatList,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, fonts, spacing, radii } from "../home/theme";
import BottomNav from "../home/BottomNav";
import { NavRoute } from "../home/types";
import {
  useWalletSummary,
  useTransactions,
  useTransaction,
  useTopup,
} from "@/hooks/useWallet";
import type { Transaction, TxType } from "@/api/wallet.api";
import { ROUTES } from "@/constants/routes";

// ─── Design tokens local to this screen ──────────────────────────────────────

const PRIMARY = colors.primary;        // #16493c
const PRIMARY_LIGHT = "#EAF3F1";
const SURFACE = "#F7F7FB";
const SUCCESS = "#10B981";
const SUCCESS_LIGHT = "#ECFDF5";
const WARNING = "#F59E0B";
const INFO = "#3B82F6";
const INFO_LIGHT = "#EFF6FF";
const ERROR = "#EF4444";
const ERROR_LIGHT = "#FFF1F2";
const PURPLE = "#7C3AED";
const PURPLE_LIGHT = "#F5F3FF";
const AMBER_LIGHT = "#FFFBEB";

// ─── Transaction metadata ─────────────────────────────────────────────────────

const TX_META: Record<
  TxType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }
> = {
  topup:      { icon: "add-circle",        color: SUCCESS,  bg: SUCCESS_LIGHT, label: "Top-up"     },
  booking:    { icon: "briefcase",          color: PRIMARY,  bg: PRIMARY_LIGHT, label: "Booking"    },
  refund:     { icon: "return-down-back",   color: INFO,     bg: INFO_LIGHT,    label: "Refund"     },
  adjustment: { icon: "swap-horizontal",    color: WARNING,  bg: AMBER_LIGHT,   label: "Adjustment" },
  call:       { icon: "call",               color: PURPLE,   bg: PURPLE_LIGHT,  label: "Call"       },
  chat:       { icon: "chatbubble-ellipses",color: PURPLE,   bg: PURPLE_LIGHT,  label: "Chat"       },
};

const STATUS_META: Record<
  "pending" | "processing" | "completed" | "failed",
  { label: string; color: string; bg: string }
> = {
  pending:    { label: "Pending",    color: WARNING, bg: AMBER_LIGHT  },
  processing: { label: "Processing", color: INFO,    bg: INFO_LIGHT   },
  completed:  { label: "Completed",  color: SUCCESS, bg: SUCCESS_LIGHT },
  failed:     { label: "Failed",     color: ERROR,   bg: ERROR_LIGHT   },
};

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS: { key: TxType | "all"; label: string }[] = [
  { key: "all",       label: "All"        },
  { key: "topup",     label: "Top-ups"    },
  { key: "booking",   label: "Bookings"   },
  { key: "refund",    label: "Refunds"    },
  { key: "call",      label: "Calls"      },
  { key: "chat",      label: "Chats"      },
  { key: "adjustment",label: "Adjustments"},
];

// ─── Topup Modal ──────────────────────────────────────────────────────────────

const QUICK_AMOUNTS = [100, 200, 500, 1000];

function TopupModal({
  visible,
  onClose,
  currentBalance,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  currentBalance: number;
  onSuccess: (newBalance: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const { isPending, topup } = useTopup();
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleConfirm = () => {
    const num = Number(amount);
    if (!num || num <= 0 || isNaN(num)) {
      shake();
      Alert.alert("Invalid Amount", "Enter a valid amount greater than ₹0.");
      return;
    }
    if (num < 10) {
      shake();
      Alert.alert("Too Low", "Minimum top-up amount is ₹10.");
      return;
    }
    topup(num, {
      onSuccess: (newBalance) => {
        onSuccess(newBalance);
        setAmount("");
        onClose();
      },
      onError: (msg) => Alert.alert("Error", msg),
    });
  };

  const handleClose = () => {
    if (isPending) return;
    setAmount("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={topupStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={topupStyles.sheet}>
          <View style={topupStyles.handle} />

          {/* Header */}
          <View style={topupStyles.header}>
            <View style={topupStyles.iconWrap}>
              <Ionicons name="wallet" size={22} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={topupStyles.title}>Add Money</Text>
              <Text style={topupStyles.subtitle}>
                Current balance: <Text style={topupStyles.balance}>₹{currentBalance.toFixed(2)}</Text>
              </Text>
            </View>
          </View>

          {/* Quick amounts */}
          <Text style={topupStyles.quickLabel}>Quick Add</Text>
          <View style={topupStyles.quickRow}>
            {QUICK_AMOUNTS.map((q) => (
              <Pressable
                key={q}
                style={[topupStyles.quickChip, amount === String(q) && topupStyles.quickChipActive]}
                onPress={() => setAmount(String(q))}
              >
                <Text style={[topupStyles.quickChipText, amount === String(q) && topupStyles.quickChipTextActive]}>
                  ₹{q}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Custom input */}
          <Text style={topupStyles.inputLabel}>Or enter amount</Text>
          <Animated.View
            style={[topupStyles.inputRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            <Text style={topupStyles.rupee}>₹</Text>
            <TextInput
              style={topupStyles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor="#BDC5CC"
              keyboardType="numeric"
            />
          </Animated.View>

          {/* Action */}
          <Pressable
            style={[topupStyles.btn, (!amount || isPending) && topupStyles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!amount || isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={18} color={colors.white} />
                <Text style={topupStyles.btnText}>Add ₹{amount || "0"} to Wallet</Text>
              </>
            )}
          </Pressable>

          <Pressable style={topupStyles.cancelBtn} onPress={handleClose} disabled={isPending}>
            <Text style={topupStyles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const topupStyles = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:           { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingBottom: 44, paddingTop: spacing.sm },
  handle:          { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginBottom: spacing.lg },
  header:          { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  iconWrap:        { width: 52, height: 52, borderRadius: 16, backgroundColor: PRIMARY_LIGHT, alignItems: "center", justifyContent: "center" },
  title:           { fontFamily: fonts.oswaldBold, fontSize: 20, color: colors.textPrimary },
  subtitle:        { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  balance:         { fontFamily: fonts.jakartaSemiBold, color: PRIMARY },
  quickLabel:      { fontFamily: fonts.jakartaSemiBold, fontSize: 12, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.sm },
  quickRow:        { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  quickChip:       { flex: 1, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: SURFACE, alignItems: "center" },
  quickChipActive: { borderColor: PRIMARY, backgroundColor: PRIMARY_LIGHT },
  quickChipText:   { fontFamily: fonts.oswaldSemiBold, fontSize: 15, color: colors.textSecondary },
  quickChipTextActive: { color: PRIMARY },
  inputLabel:      { fontFamily: fonts.jakartaSemiBold, fontSize: 12, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.sm },
  inputRow:        { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: PRIMARY, borderRadius: radii.md, paddingHorizontal: spacing.md, backgroundColor: SURFACE, marginBottom: spacing.lg },
  rupee:           { fontFamily: fonts.oswaldBold, fontSize: 28, color: colors.textPrimary, marginRight: 6 },
  input:           { flex: 1, fontFamily: fonts.oswaldBold, fontSize: 28, color: colors.textPrimary, paddingVertical: spacing.md },
  btn:             { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: PRIMARY, borderRadius: radii.pill, paddingVertical: 15, marginBottom: spacing.sm },
  btnDisabled:     { backgroundColor: "#BDC5CC" },
  btnText:         { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.white },
  cancelBtn:       { alignItems: "center", paddingVertical: 10 },
  cancelText:      { fontFamily: fonts.jakartaMedium, fontSize: 14, color: colors.textSecondary },
});

// ─── Transaction Detail Modal ─────────────────────────────────────────────────

function TxDetailModal({
  visible,
  txId,
  onClose,
}: {
  visible: boolean;
  txId: string | null;
  onClose: () => void;
}) {
  const { transaction: tx, isLoading } = useTransaction(txId ?? "", visible && !!txId);

  const meta       = tx ? TX_META[tx.type] : null;
  const statusMeta = tx ? STATUS_META[tx.status] : null;
  const isCredit   = tx?.direction === "credit";

  const date    = tx ? new Date(tx.createdAt) : null;
  const dateStr = date?.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = date?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const booking      = tx?.booking;
  const partnerName  = booking?.partner?.name ?? null;
  const serviceLabel = booking?.serviceLabel
    ?? (booking?.category?.name ?? null);
  const addr         = booking?.serviceAddress;
  const addrStr      = addr
    ? [addr.locality, addr.city, addr.state].filter(Boolean).join(", ")
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={detailStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={detailStyles.sheet}>
          <View style={detailStyles.handle} />

          {isLoading || !tx ? (
            <View style={detailStyles.loadWrap}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Amount hero */}
              <View style={detailStyles.hero}>
                <View style={[detailStyles.typeIcon, { backgroundColor: meta!.bg }]}>
                  <Ionicons name={meta!.icon} size={30} color={meta!.color} />
                </View>
                <Text style={[detailStyles.amount, isCredit && detailStyles.amountCredit]}>
                  {isCredit ? "+" : "−"}₹{tx.amount}
                </Text>
                <Text style={detailStyles.typeLabel}>{meta!.label}</Text>
              </View>

              {/* Status pill */}
              <View style={[detailStyles.statusPill, { backgroundColor: `${statusMeta!.color}18` }]}>
                <View style={[detailStyles.statusDot, { backgroundColor: statusMeta!.color }]} />
                <Text style={[detailStyles.statusText, { color: statusMeta!.color }]}>
                  {statusMeta!.label}
                </Text>
              </View>

              {/* Transaction details */}
              <View style={detailStyles.section}>
                <Text style={detailStyles.sectionTitle}>Transaction Details</Text>
                <DetailRow icon="calendar-outline"     label="Date"          value={`${dateStr} at ${timeStr}`} />
                <DetailRow icon="receipt-outline"      label="Ref ID"        value={tx._id} mono />
                <DetailRow icon="swap-horizontal"      label="Type"          value={isCredit ? "Credit" : "Debit"} />
                <DetailRow icon="wallet-outline"       label="Balance after" value={`₹${tx.balanceAfter.toFixed(2)}`} />
                {tx.description ? (
                  <DetailRow icon="document-text-outline" label="Note" value={tx.description} />
                ) : null}
                {tx.failureReason ? (
                  <DetailRow icon="alert-circle-outline" label="Failure" value={tx.failureReason} error />
                ) : null}
              </View>

              {/* Booking details */}
              {booking && (
                <View style={detailStyles.section}>
                  <Text style={detailStyles.sectionTitle}>Booking Details</Text>
                  {partnerName && (
                    <DetailRow icon="person-outline"    label="Partner"   value={partnerName} />
                  )}
                  {serviceLabel && (
                    <DetailRow icon="construct-outline" label="Service"   value={serviceLabel} />
                  )}
                  {booking.description ? (
                    <DetailRow icon="chatbubble-outline" label="Description" value={booking.description} />
                  ) : null}
                  {addrStr && (
                    <DetailRow icon="location-outline"  label="Location"  value={addrStr} />
                  )}
                  {booking.scheduledAt && (
                    <DetailRow icon="time-outline"      label="Scheduled" value={
                      new Date(booking.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    } />
                  )}
                  {booking.completedAt && (
                    <DetailRow icon="checkmark-circle-outline" label="Completed" value={
                      new Date(booking.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    } />
                  )}
                  {booking.visitingCredit != null && (
                    <DetailRow icon="cash-outline" label="Visiting Fee" value={`₹${booking.visitingCredit}`} highlight />
                  )}
                </View>
              )}

              {/* Payment details (topup) */}
              {tx.paymentDetails?.gateway && (
                <View style={detailStyles.section}>
                  <Text style={detailStyles.sectionTitle}>Payment Details</Text>
                  <DetailRow icon="card-outline"    label="Gateway" value={tx.paymentDetails.gateway} />
                  {tx.paymentDetails.paymentMethod && (
                    <DetailRow icon="wallet-outline" label="Method" value={tx.paymentDetails.paymentMethod} />
                  )}
                  {tx.paymentDetails.gatewayPaymentId && (
                    <DetailRow icon="barcode-outline" label="Payment ID" value={tx.paymentDetails.gatewayPaymentId} mono />
                  )}
                </View>
              )}

              <Pressable style={detailStyles.closeBtn} onPress={onClose}>
                <Text style={detailStyles.closeBtnText}>Close</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({
  icon, label, value, mono = false, error = false, highlight = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  mono?: boolean;
  error?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={detailStyles.row}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} style={detailStyles.rowIcon} />
      <Text style={detailStyles.rowLabel}>{label}</Text>
      <Text
        style={[
          detailStyles.rowValue,
          mono      && detailStyles.rowMono,
          error     && detailStyles.rowError,
          highlight && detailStyles.rowHighlight,
        ]}
        numberOfLines={2}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingBottom: 44, paddingTop: spacing.sm, maxHeight: "92%" },
  handle:     { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginBottom: spacing.lg },
  loadWrap:   { paddingVertical: spacing.xl * 2, alignItems: "center" },
  hero:       { alignItems: "center", paddingVertical: spacing.md, marginBottom: spacing.sm },
  typeIcon:   { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  amount:     { fontFamily: fonts.oswaldBold, fontSize: 42, color: colors.textPrimary },
  amountCredit: { color: SUCCESS },
  typeLabel:  { fontFamily: fonts.jostMedium, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, marginBottom: spacing.md, alignSelf: "center" },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.jakartaSemiBold, fontSize: 13 },
  section:    { backgroundColor: SURFACE, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 11, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: spacing.sm },
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  rowIcon:    { marginRight: spacing.sm, width: 16 },
  rowLabel:   { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, width: 108 },
  rowValue:   { flex: 1, fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.textPrimary, textAlign: "right" },
  rowMono:    { fontFamily: fonts.jakartaRegular, fontSize: 10, letterSpacing: 0.3 },
  rowError:   { color: ERROR },
  rowHighlight: { color: PRIMARY, fontFamily: fonts.jakartaSemiBold },
  closeBtn:   { backgroundColor: SURFACE, borderRadius: radii.pill, paddingVertical: 14, alignItems: "center", marginTop: spacing.xs },
  closeBtnText: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.textSecondary },
});

// ─── Transaction Card ─────────────────────────────────────────────────────────

function TxCard({ tx, onPress }: { tx: Transaction; onPress: () => void }) {
  const meta       = TX_META[tx.type];
  const statusMeta = STATUS_META[tx.status];
  const isCredit   = tx.direction === "credit";

  const date    = new Date(tx.createdAt);
  const dateStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const primaryLabel =
    tx.type === "booking" && tx.booking?.partner?.name
      ? `Booking — ${tx.booking.partner.name}`
      : tx.description || meta.label;

  const subLabel =
    tx.type === "booking" && tx.booking?.serviceLabel
      ? tx.booking.serviceLabel
      : `${dateStr} · ${timeStr}`;

  return (
    <Pressable
      style={({ pressed }) => [txStyles.card, pressed && txStyles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Transaction: ${primaryLabel}`}
    >
      <View style={[txStyles.iconWrap, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={txStyles.body}>
        <Text style={txStyles.label} numberOfLines={1}>{primaryLabel}</Text>
        <View style={txStyles.meta}>
          <Text style={txStyles.sub}>{subLabel}</Text>
          {tx.status !== "completed" && (
            <View style={[txStyles.badge, { backgroundColor: `${statusMeta.color}18`, borderColor: `${statusMeta.color}50` }]}>
              <Text style={[txStyles.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={txStyles.right}>
        <Text style={[txStyles.amount, isCredit && txStyles.amountCredit]}>
          {isCredit ? "+" : "−"}₹{tx.amount}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

const txStyles = StyleSheet.create({
  card:         { flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, marginBottom: 1 },
  cardPressed:  { opacity: 0.7, backgroundColor: SURFACE },
  iconWrap:     { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  body:         { flex: 1, gap: 3 },
  label:        { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.textPrimary },
  meta:         { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  sub:          { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary },
  badge:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm, borderWidth: 1 },
  badgeText:    { fontFamily: fonts.jakartaSemiBold, fontSize: 10 },
  right:        { flexDirection: "row", alignItems: "center", gap: 4 },
  amount:       { fontFamily: fonts.oswaldBold, fontSize: 16, color: colors.textPrimary },
  amountCredit: { color: SUCCESS },
});

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function SkeletonBar({ width, height = 14, style }: { width: number | string; height?: number; style?: any }) {
  return (
    <View
      style={[
        { width: width as any, height, borderRadius: 6, backgroundColor: "#EEF0F3" },
        style,
      ]}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const [topupVisible, setTopupVisible] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { summary, loading: summaryLoading, refresh: refreshSummary } = useWalletSummary();
  const {
    transactions,
    loading: txLoading,
    loadingMore,
    activeType,
    setActiveType,
    refresh: refreshTx,
    loadMore,
  } = useTransactions({ limit: 15 });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshSummary(), refreshTx()]);
    setRefreshing(false);
  }, [refreshSummary, refreshTx]);

  const handleTopupSuccess = useCallback(async (newBalance: number) => {
    await refreshSummary();
    await refreshTx();
    Alert.alert("Money Added!", `₹${newBalance.toFixed(2)} is your new balance.`);
  }, [refreshSummary, refreshTx]);

  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === "wallet") return; // Already here
    if (route === "home")     router.navigate(ROUTES.APP.HOME     as any);
    if (route === "bookings") router.navigate(ROUTES.APP.BOOKINGS as any);
    if (route === "chat")     router.navigate(ROUTES.APP.CHAT     as any);
    if (route === "profile")  router.navigate(ROUTES.APP.PROFILE  as any);
  }, []);

  const balance      = summary?.walletBalance  ?? 0;
  const totalTopups  = summary?.totalTopups    ?? 0;
  const totalSpent   = summary?.totalSpent     ?? 0;
  const totalRefunds = summary?.totalRefunds   ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.navbar}>
        <Text style={s.navTitle}>Wallet</Text>
        <Pressable
          style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setTopupVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add money"
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={s.addBtnText}>Add Money</Text>
        </Pressable>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <>
            {/* ── Balance card ─────────────────────────────────────────── */}
            {summaryLoading ? (
              <View style={s.balanceCard}>
                <SkeletonBar width={100} height={13} style={{ marginBottom: spacing.sm }} />
                <SkeletonBar width={180} height={48} style={{ marginBottom: spacing.lg }} />
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <SkeletonBar width={80} height={40} />
                  <SkeletonBar width={80} height={40} />
                  <SkeletonBar width={80} height={40} />
                </View>
              </View>
            ) : (
              <View style={s.balanceCard}>
                <Text style={s.balanceLabel}>Available Balance</Text>
                <Text style={s.balanceAmount}>₹{balance.toFixed(2)}</Text>

                {/* Stats row */}
                <View style={s.statsRow}>
                  <View style={s.statItem}>
                    <View style={s.statIconWrap}>
                      <Ionicons name="arrow-up-circle" size={16} color={SUCCESS} />
                    </View>
                    <Text style={s.statValue}>₹{totalTopups}</Text>
                    <Text style={s.statLabel}>Added</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <View style={s.statIconWrap}>
                      <Ionicons name="arrow-down-circle" size={16} color={ERROR} />
                    </View>
                    <Text style={s.statValue}>₹{totalSpent}</Text>
                    <Text style={s.statLabel}>Spent</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <View style={s.statIconWrap}>
                      <Ionicons name="return-down-back" size={16} color={INFO} />
                    </View>
                    <Text style={s.statValue}>₹{totalRefunds}</Text>
                    <Text style={s.statLabel}>Refunded</Text>
                  </View>
                </View>

                {/* Low balance warning */}
                {balance < 50 && (
                  <Pressable
                    style={s.lowBalanceWarn}
                    onPress={() => setTopupVisible(true)}
                  >
                    <Ionicons name="warning-outline" size={14} color={WARNING} />
                    <Text style={s.lowBalanceText}>Low balance — tap to add money</Text>
                    <Ionicons name="chevron-forward" size={14} color={WARNING} />
                  </Pressable>
                )}
              </View>
            )}

            {/* ── How wallet works card ─────────────────────────────────── */}
            <View style={s.infoCard}>
              <Ionicons name="information-circle" size={18} color={PRIMARY} />
              <Text style={s.infoText}>
                Add money to your wallet and use it to book services, call, or chat with partners.
              </Text>
            </View>

            {/* ── Filter tabs ───────────────────────────────────────────── */}
            <Text style={s.sectionHeading}>Transactions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterRow}
            >
              {FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  style={[s.filterChip, activeType === f.key && s.filterChipActive]}
                  onPress={() => setActiveType(f.key as any)}
                >
                  <Text style={[s.filterChipText, activeType === f.key && s.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Loading state for transactions */}
            {txLoading && (
              <View style={s.txGroup}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={txStyles.card}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#EEF0F3", marginRight: spacing.sm }} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <SkeletonBar width="70%" />
                      <SkeletonBar width="45%" height={11} />
                    </View>
                    <SkeletonBar width={52} />
                  </View>
                ))}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !txLoading ? (
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={40} color={PRIMARY} />
              </View>
              <Text style={s.emptyTitle}>No transactions yet</Text>
              <Text style={s.emptySub}>
                Top up your wallet to start booking services.
              </Text>
              <Pressable style={s.emptyBtn} onPress={() => setTopupVisible(true)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.white} />
                <Text style={s.emptyBtnText}>Add Money</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TxCard tx={item} onPress={() => setSelectedTxId(item._id)} />
        )}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: spacing.lg }} />
          ) : null
        }
      />

      <BottomNav onNavigate={handleNavigate} />

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <TopupModal
        visible={topupVisible}
        onClose={() => setTopupVisible(false)}
        currentBalance={balance}
        onSuccess={handleTopupSuccess}
      />

      <TxDetailModal
        visible={selectedTxId !== null}
        txId={selectedTxId}
        onClose={() => setSelectedTxId(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.background },
  listContent:   { paddingHorizontal: spacing.lg, paddingBottom: 110 },

  // Navbar
  navbar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  navTitle:      { fontFamily: fonts.oswaldBold, fontSize: 26, color: colors.textPrimary },
  addBtn:        { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: PRIMARY, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  addBtnText:    { fontFamily: fonts.jakartaSemiBold, fontSize: 13, color: colors.white },

  // Balance card
  balanceCard:   {
    backgroundColor: PRIMARY,
    borderRadius: radii.lg + 4,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  balanceLabel:  { fontFamily: fonts.jostMedium, fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: spacing.xs },
  balanceAmount: { fontFamily: fonts.oswaldBold, fontSize: 44, color: colors.white, marginBottom: spacing.md },

  // Stats
  statsRow:      { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.18)", borderRadius: radii.md, padding: spacing.sm + 4 },
  statItem:      { flex: 1, alignItems: "center", gap: 3 },
  statIconWrap:  { width: 30, height: 30, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statValue:     { fontFamily: fonts.oswaldSemiBold, fontSize: 15, color: colors.white },
  statLabel:     { fontFamily: fonts.jostRegular, fontSize: 11, color: "rgba(255,255,255,0.65)" },
  statDivider:   { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.2)" },

  // Low balance warning
  lowBalanceWarn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: "rgba(245,158,11,0.15)", borderRadius: radii.sm, paddingHorizontal: spacing.sm + 2, paddingVertical: 8, marginTop: spacing.md },
  lowBalanceText: { flex: 1, fontFamily: fonts.jakartaMedium, fontSize: 12, color: WARNING },

  // Info card
  infoCard:      { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: PRIMARY_LIGHT, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, marginBottom: spacing.md },
  infoText:      { flex: 1, fontFamily: fonts.jostRegular, fontSize: 12, color: PRIMARY, lineHeight: 18 },

  // Section heading
  sectionHeading:{ fontFamily: fonts.oswaldSemiBold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.sm },

  // Filter tabs
  filterRow:     { gap: spacing.sm, paddingBottom: spacing.sm, marginBottom: spacing.sm },
  filterChip:    { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: SURFACE, borderWidth: 1.5, borderColor: "#E5E7EB" },
  filterChipActive: { backgroundColor: PRIMARY_LIGHT, borderColor: PRIMARY },
  filterChipText:   { fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.textSecondary },
  filterChipTextActive: { color: PRIMARY, fontFamily: fonts.jakartaSemiBold },

  // Transaction group wrapper
  txGroup:       { backgroundColor: colors.background, borderRadius: radii.md, overflow: "hidden" },
  separator:     { height: 1, backgroundColor: "#F3F4F6", marginLeft: 56 + spacing.sm },

  // Empty state
  emptyState:    { alignItems: "center", paddingVertical: spacing.xl * 1.5, paddingHorizontal: spacing.lg },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: PRIMARY_LIGHT, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  emptyTitle:    { fontFamily: fonts.oswaldSemiBold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.xs },
  emptySub:      { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg },
  emptyBtn:      { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: PRIMARY, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 4 },
  emptyBtnText:  { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.white },
});
