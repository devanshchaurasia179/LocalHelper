/**
 * Partner Chat Room Screen
 *
 * Individual conversation view with message history, real-time updates,
 * and typing indicators.
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
  Modal,
  Alert,
  AppState,
  type AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, spacing, radii } from "@/constants/theme";
import { useChatRoom } from "@/hooks/useChatRoom";
import { getConnectedSocket } from "@/services/chat.socket";
import { useCall } from "@/providers/CallProvider";
import {
  checkChatAccess,
  purchaseChatTime,
  startChatSession,
  endChatSession,
  type ChatAccessResponse,
  type ChatMessage,
} from "@/api/chat.api";
import PurchaseChatTimeModal from "@/components/chat/PurchaseChatTimeModal";

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

// ─── Call Confirm Modal ───────────────────────────────────────────────────────

function CallConfirmModal({
  visible,
  customerName,
  walletBalance,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  customerName: string;
  walletBalance: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={callConfirmStyles.overlay}>
        <View style={callConfirmStyles.card}>
          <View style={callConfirmStyles.iconWrap}>
            <Ionicons name="call" size={28} color="#6366F1" />
          </View>
          <Text style={callConfirmStyles.title}>Call {customerName}?</Text>
          <Text style={callConfirmStyles.message}>
            Call charges are{" "}
            <Text style={callConfirmStyles.rate}>₹30 / min</Text>
            {" "}and will be deducted from your wallet.
          </Text>
          <View style={callConfirmStyles.balanceRow}>
            <Ionicons name="wallet-outline" size={16} color="#6B7280" />
            <Text style={callConfirmStyles.balanceLabel}>Your wallet balance:</Text>
            <Text style={callConfirmStyles.balanceValue}>₹{walletBalance.toFixed(2)}</Text>
          </View>
          {walletBalance < 30 && (
            <View style={callConfirmStyles.warnRow}>
              <Ionicons name="warning-outline" size={14} color="#EF4444" />
              <Text style={callConfirmStyles.warnText}>
                Insufficient balance. Minimum ₹30 required.
              </Text>
            </View>
          )}
          <View style={callConfirmStyles.btnRow}>
            <Pressable style={callConfirmStyles.cancelBtn} onPress={onCancel}>
              <Text style={callConfirmStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                callConfirmStyles.confirmBtn,
                walletBalance < 30 && callConfirmStyles.confirmBtnDisabled,
              ]}
              onPress={onConfirm}
              disabled={walletBalance < 30}
            >
              <Ionicons name="call" size={16} color="#fff" />
              <Text style={callConfirmStyles.confirmBtnText}>Dial Now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Warning Modal Component ──────────────────────────────────────────────────

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

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) {
  // Tick indicator for my own messages
  const renderTick = () => {
    if (!isMe) return null;

    if (msg.isSending) {
      // Clock — pending / optimistic
      return <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />;
    }
    if (msg.hasFailed) {
      // Red alert — send failed
      return <Ionicons name="alert-circle" size={12} color={colors.error} />;
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
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {msg.text ? (
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {msg.text}
          </Text>
        ) : null}
        <View style={styles.bubbleFooter}>
          <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
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
    customerId?: string;
    customerName?: string;
    customerPhoto?: string;
  }>();

  const conversationId = params.conversationId!;
  const customerId = params.customerId ?? "";
  const customerName = params.customerName ?? "Customer";
  const customerPhoto = params.customerPhoto;

  const { initiateCall, processing: callProcessing } = useCall();

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
  const [callConfirmVisible, setCallConfirmVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Chat access & payment state ───────────────────────────────────────────
  const [chatAccess, setChatAccess] = useState<ChatAccessResponse | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [chatAccessLoading, setChatAccessLoading] = useState(false);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const handleCall = useCallback(() => {
    if (!customerId) return;
    setCallConfirmVisible(true);
  }, [customerId]);

  const handleCallConfirmed = useCallback(() => {
    setCallConfirmVisible(false);
    initiateCall(customerId, customerName);
  }, [customerId, customerName, initiateCall]);

  // ── Chat Access & Timer Functions ─────────────────────────────────────────

  const fetchChatAccess = useCallback(async () => {
    if (!conversationId) return;
    setChatAccessLoading(true);
    try {
      const response = await checkChatAccess(conversationId);
      setChatAccess(response.data);
      setRemainingSeconds(response.data.remainingSeconds);
    } catch (err) {
      console.error("Failed to fetch chat access:", err);
    } finally {
      setChatAccessLoading(false);
    }
  }, [conversationId]);

  const handlePurchaseTime = useCallback(
    async (minutes: number) => {
      try {
        const response = await purchaseChatTime(conversationId, minutes);
        setWalletBalance(response.data.walletBalance);
        setRemainingSeconds(response.data.remainingSeconds);
        
        // Refresh chat access
        await fetchChatAccess();
        
        // Emit a socket event to notify the customer that time was purchased
        const socket = getConnectedSocket();
        if (socket?.connected) {
          socket.emit("chat_time_purchased", { conversationId, userType: "partner" });
        }
        
        Alert.alert(
          "Success",
          `${minutes} minute${minutes > 1 ? "s" : ""} of chat time added!`
        );
      } catch (err: any) {
        throw err; // Let modal handle the error
      }
    },
    [conversationId, fetchChatAccess]
  );

  const startCountdownTimer = useCallback(() => {
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // Start new countdown
    timerIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Time expired
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
          fetchChatAccess(); // Refresh to get latest status
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [fetchChatAccess]);

  const stopCountdownTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const handleSessionStart = useCallback(async () => {
    try {
      await startChatSession(conversationId);
      console.log("Chat session started");
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  }, [conversationId]);

  const handleSessionEnd = useCallback(() => {
    // Fire-and-forget — this runs during unmount / background transitions,
    // so we deliberately don't await and silently swallow network errors
    // that are expected when the app is backgrounding or the screen tears down.
    endChatSession(conversationId).catch(() => {});
  }, [conversationId]);

  // ── Load wallet balance ───────────────────────────────────────────────────
  const fetchWalletBalance = useCallback(async () => {
    try {
      const { api } = await import("@/constants/api");
      const response = await api.get<{ summary: { walletBalance: number } }>("/partner/transactions/summary");
      setWalletBalance(response.data.summary.walletBalance);
    } catch (err) {
      console.error("Failed to fetch wallet balance:", err);
    }
  }, []);

  // ── Initialize chat access and session tracking ───────────────────────────
  useEffect(() => {
    fetchChatAccess();
    fetchWalletBalance();
    handleSessionStart();

    // Start timer if there's remaining time
    if (remainingSeconds > 0) {
      startCountdownTimer();
    }

    return () => {
      stopCountdownTimer();
      handleSessionEnd();
    };
  }, [conversationId]); // Only run on mount/unmount

  // ── Handle app state changes (background/foreground) ──────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App came to foreground - refresh chat access
        fetchChatAccess();
      } else if (
        appStateRef.current === "active" &&
        nextAppState.match(/inactive|background/)
      ) {
        // App went to background - end session
        handleSessionEnd();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [fetchChatAccess, handleSessionEnd]);

  // ── Update timer when remaining seconds change ────────────────────────────
  useEffect(() => {
    if (remainingSeconds > 0 && !timerIntervalRef.current) {
      startCountdownTimer();
    } else if (remainingSeconds <= 0) {
      stopCountdownTimer();
    }
  }, [remainingSeconds, startCountdownTimer, stopCountdownTimer]);

  const hasActiveChatTime = chatAccess?.hasAccess && remainingSeconds > 0;
  const canSendMessages = hasActiveChatTime;

  const formatRemainingTime = (seconds: number) => {
    if (seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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

    // Check if partner has active chat time
    if (!canSendMessages) {
      setPurchaseModalVisible(true);
      return;
    }

    // Check for phone numbers
    if (containsPhoneNumber(trimmed)) {
      setPhoneWarningVisible(true);
      return;
    }

    sendMessage(trimmed);
    setInputText("");
    onTypingStop();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [inputText, sendMessage, onTypingStop, canSendMessages]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
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
                <View style={[styles.headerDot, isOtherOnline && styles.headerDotOn]} />
                <Text style={styles.headerStatus}>
                  {isOtherOnline ? "Online" : "Offline"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Chat Timer */}
        <Pressable
          style={[
            styles.timerWrap,
            !hasActiveChatTime && styles.timerWrapExpired,
          ]}
          onPress={() => setPurchaseModalVisible(true)}
        >
          <Ionicons
            name={hasActiveChatTime ? "time-outline" : "lock-closed"}
            size={14}
            color={hasActiveChatTime ? colors.success : colors.error}
          />
          <Text
            style={[
              styles.timerText,
              !hasActiveChatTime && styles.timerTextExpired,
            ]}
          >
            {hasActiveChatTime ? formatRemainingTime(remainingSeconds) : "Expired"}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleCall}
          hitSlop={8}
          disabled={callProcessing || !customerId}
          accessibilityLabel="Call customer"
          style={styles.callBtn}
        >
          <Ionicons name="call" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Messages + Input wrapped together so keyboard shrinks the list */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
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
        <View style={styles.inputWrap}>
          {!canSendMessages ? (
            <View style={styles.expiredWrap}>
              <Ionicons name="lock-closed" size={20} color={colors.error} />
              <Text style={styles.expiredText}>Chat time expired</Text>
              <Pressable
                style={styles.expiredBtn}
                onPress={() => setPurchaseModalVisible(true)}
              >
                <Text style={styles.expiredBtnText}>Purchase Time</Text>
              </Pressable>
            </View>
          ) : (
            <>
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
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Call Confirm Modal */}
      <CallConfirmModal
        visible={callConfirmVisible}
        customerName={customerName}
        walletBalance={walletBalance}
        onConfirm={handleCallConfirmed}
        onCancel={() => setCallConfirmVisible(false)}
      />

      {/* Phone Number Warning Modal */}
      <PhoneWarningModal
        visible={phoneWarningVisible}
        onClose={() => setPhoneWarningVisible(false)}
      />

      {/* Purchase Chat Time Modal */}
      <PurchaseChatTimeModal
        visible={purchaseModalVisible}
        onClose={() => setPurchaseModalVisible(false)}
        onPurchase={handlePurchaseTime}
        walletBalance={walletBalance}
        currentRemainingSeconds={remainingSeconds}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

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
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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

  // Timer styles
  timerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerWrapExpired: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  timerText: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: colors.success,
  },
  timerTextExpired: {
    color: colors.error,
  },

  // Expired input styles
  expiredWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  expiredText: {
    flex: 1,
    fontFamily: fonts.jostMedium,
    fontSize: 14,
    color: colors.error,
  },
  expiredBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  expiredBtnText: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 13,
    color: colors.white,
  },
});

// ─── Call Confirm Modal Styles ────────────────────────────────────────────────

const callConfirmStyles = StyleSheet.create({
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
    lineHeight: 20,
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

const warningStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
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
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 18,
    color: "#1C1C28",
    marginBottom: 8,
  },
  message: {
    fontFamily: fonts.jostRegular,
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
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: "#fff",
  },
});
