/**
 * Customer Chat Tab — Conversation List Screen
 *
 * Uses static brand colors (home/theme) to avoid the dark-mode black-page bug
 * that occurred when useTheme() returned Colors.dark.background = '#000000'.
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
import { useConversations } from "@/hooks/useConversations";
import { connectChatSocket, getChatSocket } from "@/services/chat.socket";
import type { Conversation } from "@/api/chat.api";
import BottomNav from "../home/BottomNav";
import { NavRoute } from "../home/types";
import { colors, spacing, radii, fonts } from "../home/theme";
import { ROUTES } from "@/constants/routes";

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
        pressed && { backgroundColor: colors.surface },
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const router = useRouter();
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
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
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
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

      <BottomNav onNavigate={handleNavigate} />
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
