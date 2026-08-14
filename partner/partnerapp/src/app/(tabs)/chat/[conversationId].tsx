/**
 * Partner Chat Room Screen
 *
 * Individual conversation view with message history, real-time updates,
 * typing indicators, and image sending.
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
  ActionSheetIOS,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { colors, fonts, spacing, radii } from "@/constants/theme";
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
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) {
  const showStatus = isMe && (msg.isSending || msg.hasFailed);

  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapOther]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {msg.mediaUrl && (
          <View>
            <Image
              source={{ uri: msg.mediaUrl }}
              style={styles.bubbleImage}
              resizeMode="cover"
            />
            {/* Upload progress overlay */}
            {msg.isSending && (
              <View style={styles.imageUploadOverlay}>
                <ActivityIndicator size="small" color={colors.white} />
              </View>
            )}
          </View>
        )}
        {msg.text ? (
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {msg.text}
          </Text>
        ) : null}
        <View style={styles.bubbleFooter}>
          <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
            {formatMessageTime(msg.createdAt)}
          </Text>
          {showStatus && (
            <View style={styles.statusIcon}>
              {msg.isSending && !msg.mediaUrl ? (
                <ActivityIndicator size={10} color={colors.white} />
              ) : msg.hasFailed ? (
                <Ionicons name="alert-circle" size={12} color={colors.error} />
              ) : null}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Date Separator ───────────────────────────────────────────────────────────

function DateSeparator({ dateStr }: { dateStr: string }) {
  return (
    <View style={styles.dateSepWrap}>
      <View style={styles.dateSepLine} />
      <Text style={styles.dateSepText}>{formatDateSeparator(dateStr)}</Text>
      <View style={styles.dateSepLine} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    conversationId: string;
    customerName?: string;
    customerPhoto?: string;
  }>();

  const conversationId = params.conversationId!;
  const customerName = params.customerName ?? "Customer";
  const customerPhoto = params.customerPhoto;

  const {
    messages,
    loading,
    loadingMore,
    error,
    isConnected,
    isTyping,
    sendMessage,
    sendImage,
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
      const isMe = item.senderType === "partner";
      const prevMsg = index > 0 ? messages[index - 1] : null;
      const showDateSep =
        !prevMsg ||
        !isSameDay(new Date(item.createdAt), new Date(prevMsg.createdAt));

      return (
        <>
          {showDateSep && <DateSeparator dateStr={item.createdAt} />}
          <MessageBubble msg={item} isMe={isMe} />
        </>
      );
    },
    [messages]
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

  // ── Image picker ──────────────────────────────────────────────────────────

  const pickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photo library in Settings."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      sendImage(asset.uri, asset.mimeType ?? "image/jpeg");
    }
  }, [sendImage]);

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow camera access in Settings."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      sendImage(asset.uri, asset.mimeType ?? "image/jpeg");
    }
  }, [sendImage]);

  const handleAttach = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Photo Library", "Take Photo"],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) pickFromLibrary();
          if (index === 2) pickFromCamera();
        }
      );
    } else {
      Alert.alert("Send Image", "Choose a source", [
        { text: "Photo Library", onPress: pickFromLibrary },
        { text: "Take Photo", onPress: pickFromCamera },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [pickFromLibrary, pickFromCamera]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          {customerPhoto ? (
            <Image source={{ uri: customerPhoto }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Ionicons name="person" size={16} color={colors.white} />
            </View>
          )}
          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {customerName}
            </Text>
            {isTyping ? (
              <Text style={styles.headerTyping}>typing…</Text>
            ) : (
              <View style={styles.headerStatusRow}>
                <View style={[styles.headerDot, isConnected && styles.headerDotOn]} />
                <Text style={styles.headerStatus}>
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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
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
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ paddingVertical: spacing.md }}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={48}
                color={colors.navInactive}
              />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySub}>Start the conversation below</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.inputWrap}>
          {/* Attach button */}
          <Pressable
            onPress={handleAttach}
            hitSlop={8}
            accessibilityLabel="Attach image"
            style={styles.attachBtn}
          >
            <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
          </Pressable>

          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Type a message…"
            placeholderTextColor={colors.textSecondary}
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
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: colors.background,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  headerTyping: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.primary,
    fontStyle: "italic",
  },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#9CA3AF" },
  headerDotOn: { backgroundColor: colors.success },
  headerStatus: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  errorText: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: {
    fontFamily: fonts.oswaldBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySub: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  dateSepWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  dateSepLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dateSepText: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    color: colors.textSecondary,
    marginHorizontal: spacing.sm,
  },

  bubbleWrap: { marginVertical: 2 },
  bubbleWrapMe: { alignItems: "flex-end" },
  bubbleWrapOther: { alignItems: "flex-start" },

  bubble: {
    maxWidth: "75%",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  bubbleMe: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.surface },

  bubbleImage: { width: 200, height: 200, borderRadius: radii.sm },
  imageUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.sm,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleText: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bubbleTextMe: { color: colors.white },

  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
  },
  bubbleTime: {
    fontFamily: fonts.jostRegular,
    fontSize: 10,
    color: colors.textSecondary,
  },
  bubbleTimeMe: { color: "rgba(255,255,255,0.8)" },
  statusIcon: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  attachBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#9CA3AF" },
});
