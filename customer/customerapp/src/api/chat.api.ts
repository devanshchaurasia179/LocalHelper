import { api } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageSenderType = "customer" | "partner";

export interface ChatMessage {
  _id: string;
  conversation: string;
  senderType: MessageSenderType;
  sender: string;
  text: string;
  mediaUrl: string | null;
  mediaType: "image" | "file" | null;
  isRead: boolean;
  readAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  // optimistic-UI only — not from server
  tempId?: string;
  isSending?: boolean;
  hasFailed?: boolean;
}

export interface ConversationParty {
  _id: string;
  fullName?: string;
  name?: string;
  profilePhoto?: string | null;
}

export interface Conversation {
  _id: string;
  customer: ConversationParty;
  partner: ConversationParty;
  booking: { _id: string; status: string; scheduledAt: string } | null;
  lastMessage: {
    text: string;
    sentAt: string | null;
    senderType: MessageSenderType | null;
  };
  unreadByCustomer: number;
  unreadByPartner: number;
  unreadCount: number; // caller-specific, set by backend
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface MessagePagination {
  total: number;
  page: number;
  totalPages: number;
}

// ─── Socket token ─────────────────────────────────────────────────────────────

/**
 * Exchange the httpOnly customer_token cookie for a short-lived JWT
 * that can be passed to Socket.IO (WebSocket can't forward httpOnly cookies).
 */
export const getSocketToken = () =>
  api.get<{ token: string; userType: string }>("/chat/socket-token");

// ─── Conversations ────────────────────────────────────────────────────────────

export const fetchMyConversations = () =>
  api.get<{ conversations: Conversation[] }>("/chat/conversations");

/**
 * Get or create the 1-to-1 conversation with a partner.
 * Called by the customer when opening a booking's chat from their side.
 */
export const getOrCreateConversation = (
  partnerId: string,
  bookingId?: string
) =>
  api.post<{ conversation: Conversation }>("/chat/conversations", {
    partnerId,
    bookingId: bookingId ?? undefined,
  });

export const deleteConversation = (conversationId: string) =>
  api.delete(`/chat/conversations/${conversationId}`);

export const markConversationRead = (conversationId: string) =>
  api.patch(`/chat/conversations/${conversationId}/read`);

// ─── Messages ─────────────────────────────────────────────────────────────────

export const fetchMessages = (
  conversationId: string,
  page = 1,
  limit = 30
) =>
  api.get<{ messages: ChatMessage[]; pagination: MessagePagination }>(
    `/chat/conversations/${conversationId}/messages`,
    { params: { page, limit } }
  );

export const sendMessageRest = (
  conversationId: string,
  text: string
) =>
  api.post<{ message: ChatMessage }>(
    `/chat/conversations/${conversationId}/messages`,
    { text }
  );

/**
 * Upload an image message via multipart/form-data.
 * The backend accepts field name "image" + optional "text".
 *
 * @param conversationId  - The conversation to post to
 * @param imageUri        - Local file URI (from expo-image-picker)
 * @param mimeType        - MIME type string e.g. "image/jpeg"
 * @param text            - Optional caption text
 */
export const sendImageMessage = (
  conversationId: string,
  imageUri: string,
  mimeType = "image/jpeg",
  text = ""
) => {
  const form = new FormData();
  const filename = imageUri.split("/").pop() ?? "photo.jpg";
  // React Native FormData accepts { uri, name, type } as a file entry
  form.append("image", { uri: imageUri, name: filename, type: mimeType } as any);
  if (text.trim()) form.append("text", text.trim());

  return api.post<{ message: ChatMessage }>(
    `/chat/conversations/${conversationId}/messages`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};

export const deleteMessage = (messageId: string) =>
  api.delete(`/chat/messages/${messageId}`);
