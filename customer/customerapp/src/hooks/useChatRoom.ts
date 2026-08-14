import { useState, useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { connectChatSocket, getChatSocket } from "@/services/chat.socket";
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
  isTyping: boolean; // other party typing?
  sendMessage: (text: string) => void;
  sendImage: (imageUri: string, mimeType?: string) => Promise<void>;
  loadMore: () => Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

/**
 * useChatRoom — Customer App
 *
 * Identical logic to partner app but with "customer" as the sender type.
 */
export function useChatRoom(conversationId: string): UseChatRoomResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const paginationRef = useRef<MessagePagination>({ total: 0, page: 1, totalPages: 1 });
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // silently fail — user can pull up again
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore]);

  // ── Socket connection + event handlers ───────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        const socket = await connectChatSocket();
        if (!mounted) return;

        setIsConnected(true);

        // Join the room
        socket.emit("join_conversation", { conversationId });

        // ── new_message (other party sent a message) ──────────────────────
        socket.on("new_message", ({ message }: { message: ChatMessage }) => {
          if (message.conversation !== conversationId) return;
          setMessages((prev) => {
            // avoid duplicates
            if (prev.some((m) => m._id === message._id)) return prev;
            return [...prev, message];
          });
          // Auto-mark as read since the screen is open
          socket.emit("mark_read", { conversationId });
        });

        // ── message_sent (our own message confirmed by server) ─────────────
        socket.on(
          "message_sent",
          ({ message, tempId }: { message: ChatMessage; tempId?: string }) => {
            if (message.conversation !== conversationId) return;
            setMessages((prev) => {
              // Replace optimistic bubble with confirmed message
              const withoutTemp = prev.filter(
                (m) => !(m.tempId && m.tempId === tempId)
              );
              if (withoutTemp.some((m) => m._id === message._id)) return withoutTemp;
              return [...withoutTemp, message];
            });
          }
        );

        // ── message_error ──────────────────────────────────────────────────
        socket.on(
          "message_error",
          ({ tempId, error }: { tempId?: string; error: string }) => {
            console.warn("[ChatRoom] message_error:", error);
            if (tempId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.tempId === tempId ? { ...m, isSending: false, hasFailed: true } : m
                )
              );
            }
          }
        );

        // ── typing indicators ──────────────────────────────────────────────
        socket.on("typing_start", ({ conversationId: cId }: { conversationId: string }) => {
          if (cId !== conversationId) return;
          setIsTyping(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          // Auto-clear if no typing_stop arrives within 3s
          typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
        });

        socket.on("typing_stop", ({ conversationId: cId }: { conversationId: string }) => {
          if (cId !== conversationId) return;
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          setIsTyping(false);
        });

        // ── disconnect handling ────────────────────────────────────────────
        socket.on("disconnect", () => {
          if (mounted) setIsConnected(false);
        });

        socket.on("connect", () => {
          if (mounted) {
            setIsConnected(true);
            // Re-join room after reconnect
            socket.emit("join_conversation", { conversationId });
          }
        });
      } catch (err) {
        console.error("[ChatRoom] socket setup error:", err);
        if (mounted) setIsConnected(false);
      }
    };

    setup();

    return () => {
      mounted = false;
      const socket = getChatSocket();
      if (socket) {
        socket.emit("leave_conversation", { conversationId });
        socket.off("new_message");
        socket.off("message_sent");
        socket.off("message_error");
        socket.off("typing_start");
        socket.off("typing_stop");
      }
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

      // Optimistic bubble
      const optimistic: ChatMessage = {
        _id: tempId,
        conversation: conversationId,
        senderType: "customer",
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

      const socket = getChatSocket();
      if (!socket) {
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId === tempId ? { ...m, isSending: false, hasFailed: true } : m
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

      // Optimistic bubble — show image immediately with a spinner
      const optimistic: ChatMessage = {
        _id: tempId,
        conversation: conversationId,
        senderType: "customer",
        sender: "",
        text: "",
        mediaUrl: imageUri, // local URI for preview
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
          if (withoutTemp.some((m) => m._id === confirmed._id)) return withoutTemp;
          return [...withoutTemp, confirmed];
        });
      } catch (err) {
        console.error("[ChatRoom] sendImage error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId === tempId ? { ...m, isSending: false, hasFailed: true } : m
          )
        );
      }
    },
    [conversationId]
  );

  const onTypingStart = useCallback(() => {
    const socket = getChatSocket();
    if (!socket) return;
    socket.emit("typing_start", { conversationId });
    // Auto send typing_stop after 2s of inactivity
    if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
    myTypingTimerRef.current = setTimeout(() => {
      socket.emit("typing_stop", { conversationId });
    }, 2000);
  }, [conversationId]);

  const onTypingStop = useCallback(() => {
    const socket = getChatSocket();
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
    isTyping,
    sendMessage,
    sendImage,
    loadMore,
    onTypingStart,
    onTypingStop,
  };
}
