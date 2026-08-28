/**
 * Customer Chat Room Screen
 * – Uses static brand colors (home/theme) to avoid the dark-mode black-page bug
 *   that occurred when useTheme() returned Colors.dark.background = '#000000'.
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
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Fonts, Spacing } from "@/constants/theme";
import { colors, fonts, spacing } from "../home/theme";
import { useChatRoom } from "@/hooks/useChatRoom";
import { initiateCallToPartner, blockPartner, unblockPartner, getBlockedPartners } from "@/api/call.api";
import CallScreen from "@/components/call/CallScreen";
import type { NearbyPartner } from "@/api/nearby.api";
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

// ─── Phone Number Detection ───────────────────────────────────────────────────

/**
 * Detects if the text contains a phone/mobile number.
 * Covers:
 *  - 10+ consecutive digits (with optional country code, spaces, dashes, dots)
 *  - English spelled-out numbers (e.g. "nine eight seven six five four three two one zero")
 *  - Mixed patterns: digits + words together (e.g. "nine 8 seven 6 five 4...")
 */
function containsPhoneNumber(text: string): boolean {
  // Word-to-digit mapping
  const wordToDigit: Record<string, string> = {
    zero: "0", one: "1", two: "2", three: "3", four: "4",
    five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  };

  // Step 1: Convert the text to a "digit-only" version by replacing number words with digits
  const lowerText = text.toLowerCase();
  let converted = lowerText;
  for (const [word, digit] of Object.entries(wordToDigit)) {
    converted = converted.replace(new RegExp(`\\b${word}\\b`, "g"), digit);
  }

  // Step 2: Extract all digits from the converted string
  const extractedDigits = converted.replace(/[^0-9]/g, "");

  // If we can extract 10+ digits (from raw numbers, spelled words, or a mix), it's a phone number
  if (extractedDigits.length >= 10) {
    return true;
  }

  // Step 3: Standard phone pattern on original text (handles formatted numbers)
  const phonePattern = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  if (phonePattern.test(text)) {
    return true;
  }

  return false;
}

// ─── Phone Warning Modal Component ───────────────────────────────────────────

function PhoneWarningModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={warningStyles.overlay}>
        <View style={warningStyles.card}>
          <View style={warningStyles.iconWrap}>
            <Ionicons name="warning" size={36} color="#EF4444" />
          </View>
          <Text style={warningStyles.title}>Warning</Text>
          <Text style={warningStyles.message}>
            Sharing mobile numbers is not allowed on this platform. This action can lead to account suspension.
          </Text>
          <Pressable style={warningStyles.btn} onPress={onClose}>
            <Text style={warningStyles.btnText}>I Understand</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = "#16493c";

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMe,
}: {
  msg: ChatMessage;
  isMe: boolean;
}) {
  // Tick indicator for my own messages
  const renderTick = () => {
    if (!isMe) return null;

    if (msg.isSending) {
      // Clock — pending / optimistic
      return <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />;
    }
    if (msg.hasFailed) {
      // Red alert — send failed
      return <Ionicons name="alert-circle" size={12} color="#EF4444" />;
    }
    if (msg.isRead) {
      // Double tick blue — seen by the other party
      return <Ionicons name="checkmark-done" size={14} color="#60A5FA" />;
    }
    // Single tick — delivered (sent to server, not yet read)
    return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" />;
  };

  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapOther]}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: isMe ? BRAND : "#F0F0F3" },
        ]}
      >
        {msg.text ? (
          <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.textPrimary }]}>
            {msg.text}
          </Text>
        ) : null}
        <View style={styles.bubbleFooter}>
          <Text
            style={[
              styles.bubbleTime,
              { color: isMe ? "rgba(255,255,255,0.75)" : colors.textSecondary },
            ]}
          >
            {formatMessageTime(msg.createdAt)}
          </Text>
          {renderTick()}
        </View>
      </View>
    </View>
  );
}

// ─── Date Separator ───────────────────────────────────────────────────────────

function DateSeparator({ dateStr }: { dateStr: string }) {
  return (
    <View style={styles.dateSepWrap}>
      <View style={[styles.dateSepLine, { backgroundColor: "#F0F0F3" }]} />
      <Text style={[styles.dateSepText, { color: colors.textSecondary }]}>
        {formatDateSeparator(dateStr)}
      </Text>
      <View style={[styles.dateSepLine, { backgroundColor: "#F0F0F3" }]} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    conversationId: string;
    partnerId?: string;
    partnerName?: string;
    partnerPhoto?: string;
  }>();

  const conversationId = params.conversationId!;
  const partnerId = params.partnerId ?? "";
  const partnerName = params.partnerName ?? "Partner";
  const partnerPhoto = params.partnerPhoto;

  const {
    messages,
    loading,
    loadingMore,
    error,
    isConnected,
    isOtherOnline,
    isTyping,
    sendMessage,
    loadMore,
    onTypingStart,
    onTypingStop,
  } = useChatRoom(conversationId);

  const [inputText, setInputText] = useState("");
  const [phoneWarningVisible, setPhoneWarningVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Three-dot menu state ──────────────────────────────────────────────────
  const [menuVisible, setMenuVisible] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // ── Call state ────────────────────────────────────────────────────────────
  const [callScreenVisible, setCallScreenVisible] = useState(false);
  const [callId, setCallId] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [livekitToken, setLivekitToken] = useState("");

  const callPartner: NearbyPartner | null = partnerId
    ? ({ _id: partnerId, fullName: partnerName, profilePhoto: partnerPhoto } as unknown as NearbyPartner)
    : null;

  const handleCall = useCallback(async () => {
    if (!partnerId) return;
    try {
      const res = await initiateCallToPartner(partnerId);
      if (!res.success || !res.call || !res.livekit) {
        Alert.alert("Call Failed", res.message ?? "Could not reach partner. Try again later.");
        return;
      }
      setCallId(res.call.id);
      setLivekitUrl(res.livekit.url);
      setLivekitToken(res.livekit.token);
      setCallScreenVisible(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Could not initiate call. Try again.";
      Alert.alert("Call Failed", msg);
    }
  }, [partnerId]);

  const handleEndCall = useCallback(() => {
    setCallScreenVisible(false);
    setCallId("");
    setLivekitUrl("");
    setLivekitToken("");
  }, []);

  // Fetch actual block status on mount
  useEffect(() => {
    if (!partnerId) return;
    getBlockedPartners()
      .then((res) => {
        if (res.success) {
          const blocked = res.blockedPartners.some((p) => p._id === partnerId);
          setIsBlocked(blocked);
        }
      })
      .catch(() => {
        // silently ignore — default to unblocked
      });
  }, [partnerId]);

  const handleBlockToggle = useCallback(() => {
    if (!partnerId) return;
    setMenuVisible(false);

    const action = isBlocked ? "Unblock" : "Block";
    const message = isBlocked
      ? `Unblock ${partnerName}? They will be able to call and message you again.`
      : `Block ${partnerName}? They won't be able to call or message you.`;

    Alert.alert(`${action} Partner`, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: action,
        style: isBlocked ? "default" : "destructive",
        onPress: async () => {
          setBlockLoading(true);
          try {
            if (isBlocked) {
              await unblockPartner(partnerId);
              setIsBlocked(false);
              Alert.alert("Unblocked", `${partnerName} has been unblocked.`);
            } else {
              await blockPartner(partnerId);
              setIsBlocked(true);
              Alert.alert("Blocked", `${partnerName} has been blocked.`);
            }
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.message || `Failed to ${action.toLowerCase()} partner.`);
          } finally {
            setBlockLoading(false);
          }
        },
      },
    ]);
  }, [partnerId, partnerName, isBlocked]);

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

    // Check for phone numbers
    if (containsPhoneNumber(trimmed)) {
      setPhoneWarningVisible(true);
      return;
    }

    sendMessage(trimmed);
    setInputText("");
    onTypingStop();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [inputText, sendMessage, onTypingStop]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: "#F0F0F0",
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
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
            <Text
              style={[styles.headerName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {partnerName}
            </Text>
            {isTyping ? (
              <Text style={styles.headerTyping}>typing…</Text>
            ) : (
              <View style={styles.headerStatusRow}>
                <View
                  style={[
                    styles.headerDot,
                    { backgroundColor: isOtherOnline ? "#10B981" : "#9CA3AF" },
                  ]}
                />
                <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>
                  {isOtherOnline ? "Online" : "Offline"}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleCall}
            hitSlop={8}
            accessibilityLabel="Call partner"
            style={styles.callBtn}
          >
            <Ionicons name="call" size={20} color={BRAND} />
          </Pressable>
          <Pressable
            onPress={() => setMenuVisible(true)}
            hitSlop={8}
            accessibilityLabel="More options"
            style={styles.menuBtn}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* ── Three-dot menu modal ────────────────────────────────────────── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuDropdown}>
            <Pressable
              style={styles.menuItem}
              onPress={handleBlockToggle}
              disabled={blockLoading}
            >
              <Ionicons
                name={isBlocked ? "lock-open-outline" : "ban-outline"}
                size={18}
                color={isBlocked ? BRAND : "#EF4444"}
              />
              <Text style={[styles.menuItemText, !isBlocked && { color: "#EF4444" }]}>
                {blockLoading ? "Processing..." : isBlocked ? "Unblock Partner" : "Block Partner"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Messages + Input wrapped together so keyboard shrinks the list */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={BRAND} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
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
                  color={BRAND}
                  style={{ paddingVertical: Spacing.three }}
                />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color="#B0B4BA" />
                <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
                  No messages yet
                </Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  Start the conversation below
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input Bar */}
        <View
          style={[
            styles.inputWrap,
            {
              borderTopColor: "#F0F0F0",
              backgroundColor: colors.background,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: "#F0F0F3",
                color: colors.textPrimary,
              },
            ]}
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
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Phone Number Warning Modal */}
      <PhoneWarningModal
        visible={phoneWarningVisible}
        onClose={() => setPhoneWarningVisible(false)}
      />

      {/* Call Screen Modal */}
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
  safe: { flex: 1 },
  flex: { flex: 1 },

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
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: "600",
  },
  headerTyping: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: BRAND,
    fontStyle: "italic",
  },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerDot: { width: 6, height: 6, borderRadius: 3 },
  headerStatus: { fontFamily: Fonts.sans, fontSize: 11 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.five,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.two,
  },

  listContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },

  emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: "700",
    marginTop: Spacing.three,
  },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },

  dateSepWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.three,
  },
  dateSepLine: { flex: 1, height: 1 },
  dateSepText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: "500",
    marginHorizontal: Spacing.two,
  },

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

  bubbleText: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },

  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
  },
  bubbleTime: { fontFamily: Fonts.sans, fontSize: 10 },

  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.three,
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
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#9CA3AF" },

  // ── Three-dot menu styles ─────────────────────────────────────────────────
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  callBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  menuDropdown: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 60,
    marginRight: 16,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1C1C28",
  },
});

// ─── Warning Modal Styles ─────────────────────────────────────────────────────

const warningStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.four,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C28",
    marginBottom: 8,
  },
  message: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  btnText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
