import { useState, useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  connectChatSocket,
  getConnectedSocket,
} from "@/services/chat.socket";
import {
  fetchMessages,
  markConversationRead,
  sendImageMessage,
  type ChatMessage,
  type MessagePagination,
} from "@/api/chat.api";

export interface UseChatRoomResult {
  messages: ChatMessage[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  isConnected: boolean;
  isOtherOnline: boolean;  // true when the other party is in this conversation room
  isTyping: boolean; // other party typing?
  sendMessage: (text: string) => void;
  sendImage: (imageUri: string, mimeType?: string) => Promise<void>;
  loadMore: () => Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

/**
 * useChatRoom — Partner App
 *
 * Manages real-time chat for a single conversation.
 * The socket singleton persists across navigations; this hook attaches
 * listeners on mount and removes them on unmount.
 */
export function useChatRoom(conversationId: string): UseChatRoomResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const paginationRef = useRef<MessagePagination>({ total: 0, page: 1, totalPages: 1 });
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── Load message history ──────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetchMessages(conversationId, 1, 30);
      setMessages(res.data.messages);
      paginationRef.current = res.data.pagination;
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load messages.");
    }
  }, [conversationId]);

  // ── Load older messages (pagination) ─────────────────────────────────────

  const loadMore = useCallback(async () => {
    const { page, totalPages } = paginationRef.current;
    if (loadingMore || page >= totalPages) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await fetchMessages(conversationId, nextPage, 30);
      setMessages((prev) => [...res.data.messages, ...prev]);
      paginationRef.current = res.data.pagination;
    } catch {
      // silently fail — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore]);

  // ── Socket connection + event handlers ───────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    const setup = async () => {
      try {
        // connectChatSocket() never rejects — always returns the socket instance
        // even if still connecting. Socket.IO handles reconnection internally.
        const socket = await connectChatSocket();
        if (!mountedRef.current) return;

        // Sync initial connected state
        setIsConnected(socket.connected);

        // ── Join the conversation room ─────────────────────────────────────
        if (socket.connected) {
          socket.emit("join_conversation", { conversationId });
        }

        // ── connect (fired on initial + every reconnect) ───────────────────
        const onConnect = () => {
          if (!mountedRef.current) return;
          setIsConnected(true);
          socket.emit("join_conversation", { conversationId });
        };

        // ── disconnect ─────────────────────────────────────────────────────
        const onDisconnect = () => {
          if (mountedRef.current) setIsConnected(false);
        };

        // ── new_message ────────────────────────────────────────────────────
        const onNewMessage = ({ message }: { message: ChatMessage }) => {
          if (message.conversation !== conversationId) return;
          setMessages((prev) => {
            if (prev.some((m) => m._id === message._id)) return prev;
            return [...prev, message];
          });
          socket.emit("mark_read", { conversationId });
        };

        // ── message_sent (own message confirmed) ───────────────────────────
        const onMessageSent = ({
          message,
          tempId,
        }: {
          message: ChatMessage;
          tempId?: string;
        }) => {
          if (message.conversation !== conversationId) return;
          setMessages((prev) => {
            const withoutTemp = prev.filter(
              (m) => !(m.tempId && m.tempId === tempId)
            );
            if (withoutTemp.some((m) => m._id === message._id)) return withoutTemp;
            return [...withoutTemp, message];
          });
        };

        // ── message_error ──────────────────────────────────────────────────
        const onMessageError = ({
          tempId,
          error: errMsg,
        }: {
          tempId?: string;
          error: string;
        }) => {
          console.warn("[ChatRoom] message_error:", errMsg);
          if (tempId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.tempId === tempId
                  ? { ...m, isSending: false, hasFailed: true }
                  : m
              )
            );
          }
        };

        // ── typing indicators ──────────────────────────────────────────────
        const onTypingStart = ({
          conversationId: cId,
        }: {
          conversationId: string;
        }) => {
          if (cId !== conversationId) return;
          setIsTyping(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(
            () => setIsTyping(false),
            3000
          );
        };

        const onTypingStop = ({
          conversationId: cId,
        }: {
          conversationId: string;
        }) => {
          if (cId !== conversationId) return;
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          setIsTyping(false);
        };

        // ── user_presence ──────────────────────────────────────────────────
        // Fired when the other party joins or leaves this conversation room.
        // callerType in the event is the OTHER party's type (customer for partner app).
        const onUserPresence = ({
          conversationId: cId,
          callerType: presenceType,
          isOnline,
        }: {
          conversationId: string;
          callerType: string;
          isOnline: boolean;
        }) => {
          if (cId !== conversationId) return;
          // Only update presence for the other party (customer), not ourselves
          if (presenceType === "customer") {
            setIsOtherOnline(isOnline);
          }
        };

        // ── messages_read ──────────────────────────────────────────────────
        // Fired when the other party (customer) reads our messages.
        const onMessagesRead = ({
          conversationId: cId,
          readBy,
        }: {
          conversationId: string;
          readBy: string;
        }) => {
          if (cId !== conversationId) return;
          // Mark all our (partner) sent messages as read
          if (readBy === "customer") {
            setMessages((prev) =>
              prev.map((m) =>
                m.senderType === "partner" && !m.isRead
                  ? { ...m, isRead: true, readAt: new Date().toISOString() }
                  : m
              )
            );
          }
        };

        // Attach all listeners
        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("new_message", onNewMessage);
        socket.on("message_sent", onMessageSent);
        socket.on("message_error", onMessageError);
        socket.on("typing_start", onTypingStart);
        socket.on("typing_stop", onTypingStop);
        socket.on("user_presence", onUserPresence);
        socket.on("messages_read", onMessagesRead);

        // Cleanup: detach only our handlers, don't disconnect the singleton
        return () => {
          socket.emit("leave_conversation", { conversationId });
          socket.off("connect", onConnect);
          socket.off("disconnect", onDisconnect);
          socket.off("new_message", onNewMessage);
          socket.off("message_sent", onMessageSent);
          socket.off("message_error", onMessageError);
          socket.off("typing_start", onTypingStart);
          socket.off("typing_stop", onTypingStop);
          socket.off("user_presence", onUserPresence);
          socket.off("messages_read", onMessagesRead);
        };
      } catch (err) {
        console.error("[ChatRoom] socket setup error:", err);
        if (mountedRef.current) setIsConnected(false);
      }
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => {
      cleanup = fn;
    });

    return () => {
      mountedRef.current = false;
      cleanup?.();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
    };
  }, [conversationId]);

  // ── Load history on mount ─────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    loadHistory().finally(() => setLoading(false));
  }, [loadHistory]);

  // ── Mark read when app comes to foreground ────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        markConversationRead(conversationId).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [conversationId]);

  // ── Send message (optimistic) ─────────────────────────────────────────────

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const tempId = `temp_${Date.now()}_${Math.random()}`;

      const optimistic: ChatMessage = {
        _id: tempId,
        conversation: conversationId,
        senderType: "partner",
        sender: "",
        text: trimmed,
        mediaUrl: null,
        mediaType: null,
        isRead: false,
        readAt: null,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tempId,
        isSending: true,
      };

      setMessages((prev) => [...prev, optimistic]);

      const socket = getConnectedSocket();
      if (!socket) {
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId === tempId
              ? { ...m, isSending: false, hasFailed: true }
              : m
          )
        );
        return;
      }

      socket.emit("send_message", { conversationId, text: trimmed, tempId });
    },
    [conversationId]
  );

  // ── Send image (REST multipart → optimistic bubble) ──────────────────────

  const sendImage = useCallback(
    async (imageUri: string, mimeType = "image/jpeg") => {
      const tempId = `temp_img_${Date.now()}_${Math.random()}`;

      const optimistic: ChatMessage = {
        _id: tempId,
        conversation: conversationId,
        senderType: "partner",
        sender: "",
        text: "",
        mediaUrl: imageUri,
        mediaType: "image",
        isRead: false,
        readAt: null,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tempId,
        isSending: true,
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        const res = await sendImageMessage(conversationId, imageUri, mimeType);
        const confirmed = res.data.message;
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.tempId !== tempId);
          if (withoutTemp.some((m) => m._id === confirmed._id))
            return withoutTemp;
          return [...withoutTemp, confirmed];
        });
      } catch (err) {
        console.error("[ChatRoom] sendImage error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId === tempId
              ? { ...m, isSending: false, hasFailed: true }
              : m
          )
        );
      }
    },
    [conversationId]
  );

  // ── Typing indicators ─────────────────────────────────────────────────────

  const onTypingStart = useCallback(() => {
    const socket = getConnectedSocket();
    if (!socket) return;
    socket.emit("typing_start", { conversationId });
    if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
    myTypingTimerRef.current = setTimeout(() => {
      socket.emit("typing_stop", { conversationId });
    }, 2000);
  }, [conversationId]);

  const onTypingStop = useCallback(() => {
    const socket = getConnectedSocket();
    if (!socket) return;
    if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
    socket.emit("typing_stop", { conversationId });
  }, [conversationId]);

  return {
    messages,
    loading,
    loadingMore,
    error,
    isConnected,
    isOtherOnline,
    isTyping,
    sendMessage,
    sendImage,
    loadMore,
    onTypingStart,
    onTypingStop,
  };
}
