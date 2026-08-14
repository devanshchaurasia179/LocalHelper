/**
 * Customer Chat Tab — Conversation List Screen
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Fonts, Colors, Spacing } from "@/constants/theme";
import { useTheme } from "@/constants/theme";
import { useConversations } from "@/hooks/useConversations";
import { connectChatSocket, getChatSocket } from "@/services/chat.socket";
import type { Conversation } from "@/api/chat.api";

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

function getInitials(name?: string): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Conversation Row ─────────────────────────────────────────────────────────

function ConversationRow({ conv, onPress }: { conv: Conversation; onPress: () => void }) {
  const theme = useTheme();
  const partner = conv.partner;
  const name = partner?.fullName ?? partner?.name ?? "Partner";
  const lastText = conv.lastMessage?.text || (conv.lastMessage?.senderType ? "📷 Image" : "No messages yet");
  const isFromMe = conv.lastMessage?.senderType === "customer";
  const unread = conv.unreadByCustomer;
  const hasUnread = unread > 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.backgroundElement : theme.background },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${name}`}
    >
      {/* Avatar */}
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

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, hasUnread && styles.rowNameBold, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.rowTime, { color: theme.textSecondary }]}>{formatTime(conv.lastMessage?.sentAt ?? null)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[
              styles.rowLastMessage,
              hasUnread && styles.rowLastMessageBold,
              { color: hasUnread ? theme.text : theme.textSecondary },
            ]}
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { conversations, loading, refreshing, error, refresh } = useConversations();
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "error">("connecting");

  // Connect socket on mount
  useEffect(() => {
    let mounted = true;

    connectChatSocket()
      .then((socket) => {
        if (!mounted) return;
        setSocketStatus("connected");

        socket.on("new_message", () => {
          refresh();
        });

        socket.on("disconnect", () => {
          if (mounted) setSocketStatus("error");
        });

        socket.on("connect", () => {
          if (mounted) setSocketStatus("connected");
        });
      })
      .catch(() => {
        if (mounted) setSocketStatus("error");
      });

    return () => {
      mounted = false;
      const socket = getChatSocket();
      if (socket) socket.off("new_message");
    };
  }, [refresh]);

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
        <Text style={[styles.title, { color: theme.text }]}>Messages</Text>
        <View style={styles.statusRow}>
          <View style={[
            styles.statusDot,
            { backgroundColor: socketStatus === "connected" ? "#10B981" : "#9CA3AF" },
          ]} />
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>
            {socketStatus === "connected" ? "Live" : socketStatus === "connecting" ? "Connecting…" : "Offline"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16493c" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
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
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#16493c" />
          }
          ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={52} color="#B0B4BA" />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No conversations yet</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                When a partner contacts you, the conversation will appear here.
              </Text>
            </View>
          }
          contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  title: { fontFamily: Fonts.sans, fontSize: 26, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: Fonts.sans, fontSize: 12 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    backgroundColor: "#16493c",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
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
    borderColor: "#fff",
  },

  rowContent: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowName: { fontFamily: Fonts.sans, fontSize: 15, fontWeight: "500", flex: 1 },
  rowNameBold: { fontWeight: "700" },
  rowTime: { fontFamily: Fonts.sans, fontSize: 12, marginLeft: 6 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  rowLastMessage: { fontFamily: Fonts.sans, fontSize: 13, flex: 1 },
  rowLastMessageBold: { fontWeight: "600" },
  badgeWrap: {
    backgroundColor: "#16493c",
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badge: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: "700", color: "#fff" },

  divider: { height: 1, marginLeft: 52 + Spacing.four + Spacing.three },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five },
  errorText: { fontFamily: Fonts.sans, fontSize: 14, textAlign: "center", marginTop: Spacing.two },
  retryBtn: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: "#16493c",
    borderRadius: 999,
  },
  retryText: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: "600", color: "#fff" },

  emptyContainer: { flex: 1 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, paddingBottom: 100 },
  emptyTitle: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: "700",
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  emptySub: { fontFamily: Fonts.sans, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
