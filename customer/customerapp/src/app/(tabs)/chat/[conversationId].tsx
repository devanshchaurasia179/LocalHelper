/**
 * Customer Chat Room Screen
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Fonts, Colors, Spacing } from "@/constants/theme";
import { useTheme } from "@/constants/theme";
import { useChatRoom } from "@/hooks/useChatRoom";
import type { ChatMessage } from "@/api/chat.api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (isSameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe, theme }: { msg: ChatMessage; isMe: boolean; theme: any }) {
  const showStatus = isMe && (msg.isSending || msg.hasFailed);

  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapOther]}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: isMe ? "#16493c" : theme.backgroundElement },
        ]}
      >
        {msg.mediaUrl && (
          <Image source={{ uri: msg.mediaUrl }} style={styles.bubbleImage} resizeMode="cover" />
        )}
        {msg.text ? (
          <Text style={[styles.bubbleText, { color: isMe ? "#fff" : theme.text }]}>
            {msg.text}
          </Text>
        ) : null}
        <View style={styles.bubbleFooter}>
          <Text style={[styles.bubbleTime, { color: isMe ? "rgba(255,255,255,0.8)" : theme.textSecondary }]}>
            {formatMessageTime(msg.createdAt)}
          </Text>
          {showStatus && (
            <View style={styles.statusIcon}>
              {msg.isSending ? (
                <ActivityIndicator size={10} color="#fff" />
              ) : msg.hasFailed ? (
                <Ionicons name="alert-circle" size={12} color="#EF4444" />
              ) : null}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Date Separator ───────────────────────────────────────────────────────────

function DateSeparator({ dateStr, theme }: { dateStr: string; theme: any }) {
  return (
    <View style={styles.dateSepWrap}>
      <View style={[styles.dateSepLine, { backgroundColor: theme.backgroundElement }]} />
      <Text style={[styles.dateSepText, { color: theme.textSecondary }]}>
        {formatDateSeparator(dateStr)}
      </Text>
      <View style={[styles.dateSepLine, { backgroundColor: theme.backgroundElement }]} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatRoomScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    conversationId: string;
    partnerName?: string;
    partnerPhoto?: string;
  }>();

  const conversationId = params.conversationId!;
  const partnerName = params.partnerName ?? "Partner";
  const partnerPhoto = params.partnerPhoto;

  const {
    messages,
    loading,
    loadingMore,
    error,
    isConnected,
    isTyping,
    sendMessage,
    loadMore,
    onTypingStart,
    onTypingStop,
  } = useChatRoom(conversationId);

  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scroll to bottom when new message arrives ────────────────────────────

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isMe = item.senderType === "customer";
      const prevMsg = index > 0 ? messages[index - 1] : null;
      const showDateSep =
        !prevMsg || !isSameDay(new Date(item.createdAt), new Date(prevMsg.createdAt));

      return (
        <>
          {showDateSep && <DateSeparator dateStr={item.createdAt} theme={theme} />}
          <MessageBubble msg={item} isMe={isMe} theme={theme} />
        </>
      );
    },
    [messages, theme]
  );

  // ── Input handlers ────────────────────────────────────────────────────────

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);

      if (text.trim()) {
        onTypingStart();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => onTypingStop(), 2000);
      } else {
        onTypingStop();
      }
    },
    [onTypingStart, onTypingStop]
  );

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInputText("");
    onTypingStop();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [inputText, sendMessage, onTypingStop]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          {partnerPhoto ? (
            <Image source={{ uri: partnerPhoto }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Ionicons name="person" size={16} color="#fff" />
            </View>
          )}
          <View>
            <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
              {partnerName}
            </Text>
            {isTyping ? (
              <Text style={styles.headerTyping}>typing...</Text>
            ) : (
              <View style={styles.headerStatusRow}>
                <View
                  style={[
                    styles.headerDot,
                    { backgroundColor: isConnected ? "#10B981" : "#9CA3AF" },
                  ]}
                />
                <Text style={[styles.headerStatus, { color: theme.textSecondary }]}>
                  {isConnected ? "Online" : "Offline"}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16493c" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#16493c" style={{ paddingVertical: Spacing.three }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color="#B0B4BA" />
              <Text style={[styles.emptyText, { color: theme.text }]}>No messages yet</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Start the conversation below
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          inverted={false}
        />
      )}

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={[styles.inputWrap, { borderTopColor: theme.backgroundElement, backgroundColor: theme.background }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
          />
          <Pressable
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            accessibilityLabel="Send"
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#16493c",
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: { fontFamily: Fonts.sans, fontSize: 15, fontWeight: "600" },
  headerTyping: { fontFamily: Fonts.sans, fontSize: 12, color: "#16493c", fontStyle: "italic" },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerDot: { width: 6, height: 6, borderRadius: 3 },
  headerStatus: { fontFamily: Fonts.sans, fontSize: 11 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five },
  errorText: { fontFamily: Fonts.sans, fontSize: 14, textAlign: "center", marginTop: Spacing.two },

  listContent: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.five },

  emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { fontFamily: Fonts.sans, fontSize: 18, fontWeight: "700", marginTop: Spacing.three },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },

  dateSepWrap: { flexDirection: "row", alignItems: "center", marginVertical: Spacing.three },
  dateSepLine: { flex: 1, height: 1 },
  dateSepText: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: "500", marginHorizontal: Spacing.two },

  bubbleWrap: { marginVertical: 2 },
  bubbleWrapMe: { alignItems: "flex-end" },
  bubbleWrapOther: { alignItems: "flex-start" },

  bubble: {
    maxWidth: "75%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },

  bubbleImage: { width: 200, height: 200, borderRadius: 8 },
  bubbleText: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },

  bubbleFooter: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  bubbleTime: { fontFamily: Fonts.sans, fontSize: 10 },
  statusIcon: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },

  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#16493c",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#9CA3AF" },
});
