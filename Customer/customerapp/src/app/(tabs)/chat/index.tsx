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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConversations } from "@/hooks/useConversations";
import { useCallHistory } from "@/hooks/useCallHistory";
import { initiateCallToPartner, type CallRecord } from "@/api/call.api";
import { connectChatSocket, getChatSocket } from "@/services/chat.socket";
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

  const handleConvPress = useCallback(
    (conv: Conversation) => {
      router.push({
        pathname: "/(tabs)/chat/[conversationId]" as any,
        params: {
          conversationId: conv._id,
          partnerName: conv.partner?.fullName ?? conv.partner?.name ?? "Partner",
          partnerPhoto: conv.partner?.profilePhoto ?? "",
        },
      });
    },
    [router]
  );

  const handleCallPartner = useCallback(async (call: CallRecord) => {
    try {
      const res = await initiateCallToPartner(call.partner._id);
      if (!res.success || !res.call || !res.livekit) {
        Alert.alert("Call Failed", res.message ?? "Could not reach partner. Try again later.");
        return;
      }
      // Build a minimal NearbyPartner-compatible object for CallScreen
      setCallPartner({
        _id: call.partner._id,
        fullName: call.partner.fullName,
        profilePhoto: call.partner.profilePhoto,
      } as NearbyPartner);
      setCallId(res.call.id);
      setLivekitUrl(res.livekit.url);
      setLivekitToken(res.livekit.token);
      setCallScreenVisible(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Could not initiate call. Try again.";
      Alert.alert("Call Failed", msg);
    }
  }, []);

  const handleEndCall = useCallback(() => {
    setCallScreenVisible(false);
    setCallPartner(null);
    setCallId("");
    setLivekitUrl("");
    setLivekitToken("");
    // Refresh call history after call ends
    refreshCalls();
  }, [refreshCalls]);

  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === "profile")  router.replace(ROUTES.APP.PROFILE  as any);
    if (route === "bookings") router.replace(ROUTES.APP.BOOKINGS as any);
    if (route === "home")     router.replace(ROUTES.APP.HOME     as any);
    if (route === "wallet")   router.replace(ROUTES.APP.WALLET   as any);
  }, [router]);

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
          partner={callPartner}
          callId={callId}
          livekitUrl={livekitUrl}
          livekitToken={livekitToken}
          onEndCall={handleEndCall}
        />
      )}
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
