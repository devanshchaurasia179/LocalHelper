/**
 * Customer Chat Tab — Messages & Call History
 *
 * Segmented control to switch between conversation list and call history.
 * Call history shows all past calls and allows re-calling partners.
 */
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConversations } from "@/hooks/useConversations";
import { useCallHistory } from "@/hooks/useCallHistory";
import { initiateCallToPartner, type CallRecord } from "@/api/call.api";
import { api } from "@/constants/api";
import { connectChatSocket, getChatSocket } from "@/services/chat.socket";
import { consumePendingChat, subscribePendingChat } from "@/services/chatDeepLink";
import type { Conversation } from "@/api/chat.api";
import type { NearbyPartner } from "@/api/nearby.api";
import CallScreen from "@/components/call/CallScreen";
import BottomNav from "../home/BottomNav";
import { NavRoute } from "../home/types";
import { colors, spacing, radii, fonts } from "../home/theme";
import { ROUTES } from "@/constants/routes";

type TabType = "chats" | "calls";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function getCallStatusInfo(status: CallRecord["status"]): { label: string; color: string; icon: string } {
  switch (status) {
    case "completed":
      return { label: "Completed", color: "#10B981", icon: "call-outline" };
    case "missed":
      return { label: "Missed", color: "#EF4444", icon: "call-outline" };
    case "rejected":
      return { label: "Declined", color: "#EF4444", icon: "close-circle-outline" };
    case "cancelled":
      return { label: "Cancelled", color: colors.textSecondary, icon: "close-outline" };
    case "failed":
      return { label: "Failed", color: "#EF4444", icon: "alert-circle-outline" };
    case "ringing":
      return { label: "Ringing", color: colors.primary, icon: "notifications-outline" };
    case "accepted":
    case "ongoing":
      return { label: "Ongoing", color: "#10B981", icon: "call-outline" };
    default:
      return { label: status, color: colors.textSecondary, icon: "call-outline" };
  }
}

// ─── Call Confirm Modal ───────────────────────────────────────────────────────

function CallConfirmModal({
  visible,
  partnerName,
  walletBalance,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  partnerName: string;
  walletBalance: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={modalStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill as any} onPress={onCancel} />
        <View style={modalStyles.card}>
          <View style={modalStyles.iconWrap}>
            <Ionicons name="call" size={28} color="#6366F1" />
          </View>
          <Text style={modalStyles.title}>Call {partnerName}?</Text>
          <Text style={modalStyles.message}>
            Call charges are{" "}
            <Text style={modalStyles.rate}>₹30 / min</Text>
            {" "}and will be deducted from your wallet after the call ends.
          </Text>
          <View style={modalStyles.balanceRow}>
            <Ionicons name="wallet-outline" size={16} color="#6B7280" />
            <Text style={modalStyles.balanceLabel}>Your wallet balance:</Text>
            <Text style={modalStyles.balanceValue}>₹{walletBalance.toFixed(2)}</Text>
          </View>
          {walletBalance < 30 && (
            <View style={modalStyles.warnRow}>
              <Ionicons name="warning-outline" size={14} color="#EF4444" />
              <Text style={modalStyles.warnText}>
                Insufficient balance. Minimum ₹30 required.
              </Text>
            </View>
          )}
          <View style={modalStyles.btnRow}>
            <Pressable style={modalStyles.cancelBtn} onPress={onCancel}>
              <Text style={modalStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                modalStyles.confirmBtn,
                walletBalance < 30 && modalStyles.confirmBtnDisabled,
              ]}
              onPress={onConfirm}
              disabled={walletBalance < 30}
            >
              <Ionicons name="call" size={16} color="#fff" />
              <Text style={modalStyles.confirmBtnText}>Dial Now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Tab Selector ─────────────────────────────────────────────────────────────

function TabSelector({ activeTab, onTabChange }: { activeTab: TabType; onTabChange: (tab: TabType) => void }) {
  return (
    <View style={styles.tabContainer}>
      <Pressable
        style={[styles.tab, activeTab === "chats" && styles.tabActive]}
        onPress={() => onTabChange("chats")}
      >
        <Ionicons
          name="chatbubbles-outline"
          size={18}
          color={activeTab === "chats" ? colors.white : colors.textSecondary}
        />
        <Text style={[styles.tabText, activeTab === "chats" && styles.tabTextActive]}>
          Chats
        </Text>
      </Pressable>
      <Pressable
        style={[styles.tab, activeTab === "calls" && styles.tabActive]}
        onPress={() => onTabChange("calls")}
      >
        <Ionicons
          name="call-outline"
          size={18}
          color={activeTab === "calls" ? colors.white : colors.textSecondary}
        />
        <Text style={[styles.tabText, activeTab === "calls" && styles.tabTextActive]}>
          Calls
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Conversation Row ─────────────────────────────────────────────────────────

function ConversationRow({ conv, onPress }: { conv: Conversation; onPress: () => void }) {
  const partner = conv.partner;
  const name = partner?.fullName ?? partner?.name ?? "Partner";
  const lastText = conv.lastMessage?.text || (conv.lastMessage?.senderType ? "📷 Image" : "No messages yet");
  const isFromMe = conv.lastMessage?.senderType === "customer";
  const unread = conv.unreadByCustomer;
  const hasUnread = unread > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${name}`}
    >
      <View style={styles.avatarWrap}>
        {partner?.profilePhoto ? (
          <Image source={{ uri: partner.profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
          </View>
        )}
        {hasUnread && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, hasUnread && styles.rowNameBold]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.rowTime}>{formatTime(conv.lastMessage?.sentAt ?? null)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.rowLastMessage, hasUnread && styles.rowLastMessageBold]}
            numberOfLines={1}
          >
            {isFromMe ? `You: ${lastText}` : lastText}
          </Text>
          {hasUnread && (
            <View style={styles.badgeWrap}>
              <Text style={styles.badge}>{unread > 99 ? "99+" : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Call History Row ─────────────────────────────────────────────────────────

function CallRow({ call, onCall }: { call: CallRecord; onCall: (call: CallRecord) => void }) {
  const partner = call.partner;
  const name = partner?.fullName ?? "Partner";
  const statusInfo = getCallStatusInfo(call.status);

  return (
    <View style={styles.row}>
      <View style={styles.avatarWrap}>
        {partner?.profilePhoto ? (
          <Image source={{ uri: partner.profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
          </View>
        )}
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
          <Text style={styles.rowTime}>{formatTime(call.createdAt)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <View style={styles.callStatusRow}>
            <Ionicons name={statusInfo.icon as any} size={14} color={statusInfo.color} />
            <Text style={[styles.callStatusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
            {call.duration > 0 && (
              <Text style={styles.callDuration}>• {formatDuration(call.duration)}</Text>
            )}
          </View>
        </View>
      </View>

      <Pressable
        style={styles.callBtn}
        onPress={() => onCall(call)}
        hitSlop={8}
        accessibilityLabel={`Call ${name}`}
      >
        <Ionicons name="call" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("chats");
  const { conversations, loading: chatsLoading, refreshing: chatsRefreshing, error: chatsError, refresh: refreshChats } = useConversations();
  const { calls, loading: callsLoading, refreshing: callsRefreshing, error: callsError, loadingMore, refresh: refreshCalls, loadMore } = useCallHistory();
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "error">("connecting");

  // Call state
  const [callPartner, setCallPartner] = useState<NearbyPartner | null>(null);
  const [callId, setCallId] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [livekitToken, setLivekitToken] = useState("");
  const [callScreenVisible, setCallScreenVisible] = useState(false);

  // Call confirm modal state
  const [pendingCallRecord, setPendingCallRecord] = useState<CallRecord | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  // Fetch wallet balance on mount so the modal shows an accurate value
  useEffect(() => {
    api
      .get<{ summary: { walletBalance: number } }>("/customer/transactions/summary")
      .then((res) => setWalletBalance(res.data.summary.walletBalance))
      .catch(() => {});
  }, []);

  // Connect socket on mount
  useEffect(() => {
    let mounted = true;

    connectChatSocket()
      .then((socket) => {
        if (!mounted) return;
        setSocketStatus(socket.connected ? "connected" : "connecting");

        socket.on("new_message", () => { refreshChats(); });
        socket.on("disconnect", () => { if (mounted) setSocketStatus("error"); });
        socket.on("connect", () => { if (mounted) setSocketStatus("connected"); });
        socket.on("connect_error", () => { if (mounted && !socket.connected) setSocketStatus("error"); });
      })
      .catch(() => { if (mounted) setSocketStatus("error"); });

    return () => {
      mounted = false;
      const socket = getChatSocket();
      if (socket) socket.off("new_message");
    };
  }, [refreshChats]);

  // Deep-link: navigate to the conversation when a chat notification is tapped.
  // Handles three cases:
  //   1. App was killed  — getInitialNotification fires before this screen mounts;
  //      routeChatTap calls setPendingChat, which we drain here on mount.
  //   2. App backgrounded — onNotificationOpenedApp fires and stores via setPendingChat;
  //      drained here on mount / re-focus.
  //   3. App foregrounded — onForegroundEvent fires while this screen is already
  //      mounted; the subscribePendingChat listener routes immediately.
  useEffect(() => {
    // Drain any tap that arrived before this screen mounted
    const pending = consumePendingChat();
    if (pending) {
      router.push({
        pathname: "/(tabs)/chat/[conversationId]" as any,
        params: { conversationId: pending.conversationId },
      });
    }

    // React to taps that arrive while this screen is already mounted
    const unsub = subscribePendingChat((p) => {
      router.push({
        pathname: "/(tabs)/chat/[conversationId]" as any,
        params: { conversationId: p.conversationId },
      });
    });

    return unsub;
  }, [router]);

  const handleConvPress = useCallback(
    (conv: Conversation) => {
      router.push({
        pathname: "/(tabs)/chat/[conversationId]" as any,
        params: {
          conversationId: conv._id,
          partnerId: conv.partner?._id ?? "",
          partnerName: conv.partner?.fullName ?? conv.partner?.name ?? "Partner",
          partnerPhoto: conv.partner?.profilePhoto ?? "",
        },
      });
    },
    [router]
  );

  const handleCallPartner = useCallback((call: CallRecord) => {
    setPendingCallRecord(call);
  }, []);

  const handleCallConfirmed = useCallback(async () => {
    if (!pendingCallRecord) return;
    const record = pendingCallRecord;
    setPendingCallRecord(null);
    try {
      const res = await initiateCallToPartner(record.partner._id);
      if (!res.success || !res.call || !res.livekit) {
        Alert.alert("Call Failed", res.message ?? "Could not reach partner. Try again later.");
        return;
      }
      setCallPartner({
        _id: record.partner._id,
        fullName: record.partner.fullName,
        profilePhoto: record.partner.profilePhoto,
      } as NearbyPartner);
      setCallId(res.call.id);
      setLivekitUrl(res.livekit.url);
      setLivekitToken(res.livekit.token);
      setCallScreenVisible(true);
      // Refresh balance after call is set up (deduction happens on endCall)
      api
        .get<{ summary: { walletBalance: number } }>("/customer/transactions/summary")
        .then((res) => setWalletBalance(res.data.summary.walletBalance))
        .catch(() => {});
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Could not initiate call. Try again.";
      const code = err?.response?.data?.code;
      const title =
        code === "INSUFFICIENT_BALANCE"         ? "Insufficient Balance" :
        code === "PARTNER_INSUFFICIENT_BALANCE"  ? "Partner Cannot Receive Calls" :
                                                   "Call Failed";
      Alert.alert(title, msg);
    }
  }, [pendingCallRecord]);

  const handleEndCall = useCallback(() => {
    setCallScreenVisible(false);
    setCallPartner(null);
    setCallId("");
    setLivekitUrl("");
    setLivekitToken("");
    // Refresh call history and wallet balance after call ends
    refreshCalls();
    api
      .get<{ summary: { walletBalance: number } }>("/customer/transactions/summary")
      .then((res) => setWalletBalance(res.data.summary.walletBalance))
      .catch(() => {});
  }, [refreshCalls]);

  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === "chat") return; // Already here
    if (route === "profile")  router.navigate(ROUTES.APP.PROFILE  as any);
    if (route === "bookings") router.navigate(ROUTES.APP.BOOKINGS as any);
    if (route === "home")     router.navigate(ROUTES.APP.HOME     as any);
    if (route === "wallet")   router.navigate(ROUTES.APP.WALLET   as any);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.statusRow}>
          <View style={[
            styles.statusDot,
            { backgroundColor: socketStatus === "connected" ? "#10B981" : "#9CA3AF" },
          ]} />
          <Text style={styles.statusText}>
            {socketStatus === "connected" ? "Live" : socketStatus === "connecting" ? "Connecting…" : "Offline"}
          </Text>
        </View>
      </View>

      {/* Tab Selector */}
      <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Chat List */}
      {activeTab === "chats" && (
        <>
          {chatsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : chatsError ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
              <Text style={styles.errorText}>{chatsError}</Text>
              <Pressable style={styles.retryBtn} onPress={refreshChats}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <ConversationRow conv={item} onPress={() => handleConvPress(item)} />
              )}
              refreshControl={
                <RefreshControl refreshing={chatsRefreshing} onRefresh={refreshChats} tintColor={colors.primary} />
              }
              ItemSeparatorComponent={() => <View style={styles.divider} />}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons name="chatbubble-ellipses-outline" size={52} color={colors.navInactive} />
                  <Text style={styles.emptyTitle}>No conversations yet</Text>
                  <Text style={styles.emptySub}>
                    When a partner contacts you, the conversation will appear here.
                  </Text>
                </View>
              }
              contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* Call History */}
      {activeTab === "calls" && (
        <>
          {callsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : callsError ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
              <Text style={styles.errorText}>{callsError}</Text>
              <Pressable style={styles.retryBtn} onPress={refreshCalls}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={calls}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <CallRow call={item} onCall={handleCallPartner} />
              )}
              refreshControl={
                <RefreshControl refreshing={callsRefreshing} onRefresh={refreshCalls} tintColor={colors.primary} />
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
              ListFooterComponent={
                loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.md }} />
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons name="call-outline" size={52} color={colors.navInactive} />
                  <Text style={styles.emptyTitle}>No calls yet</Text>
                  <Text style={styles.emptySub}>
                    Your call history with partners will appear here.
                  </Text>
                </View>
              }
              contentContainerStyle={calls.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      <BottomNav onNavigate={handleNavigate} />

      {/* Call Screen overlay */}
      {callPartner && (
        <CallScreen
          visible={callScreenVisible}
          partnerName={callPartner.fullName ?? 'Partner'}
          callId={callId}
          livekitUrl={livekitUrl}
          livekitToken={livekitToken}
          onEndCall={handleEndCall}
        />
      )}

      {/* Call Confirm Modal */}
      <CallConfirmModal
        visible={pendingCallRecord !== null}
        partnerName={pendingCallRecord?.partner?.fullName ?? "Partner"}
        walletBalance={walletBalance}
        onConfirm={handleCallConfirmed}
        onCancel={() => setPendingCallRecord(null)}
      />
    </SafeAreaView>
  );
}


// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  title: {
    fontFamily: fonts.oswaldBold,
    fontSize: 26,
    color: colors.textPrimary,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary },

  // Tab selector
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: radii.pill,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },

  // Row styles
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontFamily: fonts.jakartaBold,
    fontSize: 17,
    color: colors.white,
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: colors.background,
  },

  rowContent:          { flex: 1, gap: 3 },
  rowTop:              { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowName:             { fontFamily: fonts.jakartaMedium, fontSize: 15, color: colors.textPrimary, flex: 1 },
  rowNameBold:         { fontFamily: fonts.jakartaBold },
  rowTime:             { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginLeft: 6 },
  rowBottom:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  rowLastMessage:      { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, flex: 1 },
  rowLastMessageBold:  { fontFamily: fonts.jostMedium, color: colors.textPrimary },
  badgeWrap:           { backgroundColor: colors.primary, borderRadius: radii.pill, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badge:               { fontFamily: fonts.jakartaBold, fontSize: 11, color: colors.white },

  // Call-specific styles
  callStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  callStatusText: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
  },
  callDuration: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },

  divider: { height: 1, backgroundColor: "#F0F0F0", marginLeft: 52 + spacing.lg + spacing.md },

  center:     { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  errorText:  { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  retryBtn:   { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: radii.pill },
  retryText:  { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.white },

  emptyContainer: { flex: 1 },
  emptyWrap:      { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, paddingBottom: 100 },
  emptyTitle:     { fontFamily: fonts.oswaldBold, fontSize: 20, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
  emptySub:       { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});

// ─── Call Confirm Modal Styles ────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(99,102,241,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 18,
    color: "#1C1C28",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 16,
  },
  rate: {
    fontFamily: fonts.jakartaSemiBold,
    color: "#1C1C28",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    width: "100%",
  },
  balanceLabel: {
    fontFamily: fonts.jostMedium,
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  balanceValue: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: "#1C1C28",
  },
  warnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    width: "100%",
  },
  warnText: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: "#EF4444",
    flex: 1,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 14,
    color: "#6B7280",
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: {
    backgroundColor: "#9CA3AF",
  },
  confirmBtnText: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 14,
    color: "#fff",
  },
});
