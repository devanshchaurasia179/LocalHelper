import jwt from "jsonwebtoken";
import Conversation from "../models/chat/Conversation.js";
import Message from "../models/chat/Message.js";

// ─── Auth middleware for Socket.IO ────────────────────────────────────────────
/**
 * Reads the JWT from socket.handshake.auth.token (preferred) or
 * socket.handshake.headers.authorization (Bearer token fallback).
 *
 * React Native can't send httpOnly cookies over a WebSocket handshake,
 * so clients must pass the token explicitly:
 *
 *   const socket = io(BASE_URL + "/chat", {
 *     auth: { token: "<jwt>", userType: "customer" | "partner" }
 *   });
 *
 * On success attaches to socket.data:
 *   { callerId: string, callerType: "customer" | "partner" }
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    const { token, userType: handshakeUserType } = socket.handshake.auth ?? {};

    if (!token) {
      return next(new Error("AUTH_REQUIRED: No token provided."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // userType can come from:
    //  1. the token payload itself (issued by /api/chat/socket-token)
    //  2. socket.handshake.auth.userType (legacy direct-token clients)
    const userType = decoded.userType ?? handshakeUserType;

    if (!["customer", "partner"].includes(userType)) {
      return next(new Error("AUTH_REQUIRED: userType must be 'customer' or 'partner'."));
    }

    socket.data.callerId   = decoded.id;
    socket.data.callerType = userType;

    next();
  } catch {
    next(new Error("AUTH_FAILED: Invalid or expired token."));
  }
};

// ─── Room helpers ─────────────────────────────────────────────────────────────

/** Canonical room name for a conversation */
const conversationRoom = (conversationId) => `conv:${conversationId}`;

/**
 * Verify that the socket's owner is actually a participant in the conversation.
 * Returns the conversation document on success, null otherwise.
 */
const verifyParticipant = async (conversationId, callerId, callerType) => {
  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return null;

  const isParticipant =
    (callerType === "customer" && conv.customer.toString() === callerId) ||
    (callerType === "partner"  && conv.partner.toString()  === callerId);

  return isParticipant ? conv : null;
};

// ─── Event handler registration ───────────────────────────────────────────────

/**
 * registerChatHandlers(namespace)
 *
 * Registers all Socket.IO event handlers on the /chat namespace.
 *
 * ── Client → Server events ─────────────────────────────────────────────────
 *
 *  join_conversation   { conversationId }
 *    Join the socket room for a conversation to start receiving messages.
 *
 *  leave_conversation  { conversationId }
 *    Leave the room (e.g. navigating away from the chat screen).
 *
 *  send_message        { conversationId, text?, tempId? }
 *    Send a text message. tempId is an optional client-side UUID used
 *    to match the server echo back to the optimistic UI message.
 *    Images are sent via the REST endpoint (POST .../messages) because
 *    they require multipart/form-data — see note below.
 *
 *  typing_start        { conversationId }
 *    Notify the other party that the user started typing.
 *
 *  typing_stop         { conversationId }
 *    Notify the other party that the user stopped typing.
 *
 *  mark_read           { conversationId }
 *    Mark all unread messages in the conversation as read and reset
 *    the caller's unread counter.
 *
 * ── Server → Client events ─────────────────────────────────────────────────
 *
 *  new_message         { message }              → broadcast to room
 *  message_sent        { message, tempId }      → ack to sender only
 *  message_error       { error, tempId }        → ack to sender only on failure
 *  typing_start        { conversationId, callerType, callerId }
 *  typing_stop         { conversationId, callerType, callerId }
 *  messages_read       { conversationId, readBy } → broadcast to room
 *  error               { message }              → sent to the affected socket
 *
 * ── NOTE: Image messages ────────────────────────────────────────────────────
 *  Images must be uploaded via the REST endpoint:
 *    POST /api/chat/conversations/:id/messages  (multipart/form-data)
 *  After a successful upload the REST controller calls
 *  emitNewMessage() which broadcasts the `new_message` event into the
 *  correct room, so both parties see it in real time.
 */
export const registerChatHandlers = (namespace) => {
  // Apply JWT auth to every connection on this namespace
  namespace.use(socketAuthMiddleware);

  namespace.on("connection", (socket) => {
    const { callerId, callerType } = socket.data;
    console.log(`[Socket] connected  — ${callerType}:${callerId}  (${socket.id})`);

    // ── join_conversation ───────────────────────────────────────────────────
    socket.on("join_conversation", async ({ conversationId } = {}) => {
      try {
        if (!conversationId) {
          return socket.emit("error", { message: "conversationId is required." });
        }

        const conv = await verifyParticipant(conversationId, callerId, callerType);
        if (!conv) {
          return socket.emit("error", {
            message: "Conversation not found or you are not a participant.",
          });
        }

        await socket.join(conversationRoom(conversationId));
        console.log(`[Socket] ${callerType}:${callerId} joined room conv:${conversationId}`);

        // Notify the other party that this user is now present in the room
        socket.to(conversationRoom(conversationId)).emit("user_presence", {
          conversationId,
          callerType,
          isOnline: true,
        });
      } catch (err) {
        console.error("[Socket] join_conversation error:", err.message);
        socket.emit("error", { message: "Failed to join conversation." });
      }
    });

    // ── leave_conversation ──────────────────────────────────────────────────
    socket.on("leave_conversation", ({ conversationId } = {}) => {
      if (conversationId) {
        socket.leave(conversationRoom(conversationId));
        console.log(`[Socket] ${callerType}:${callerId} left room conv:${conversationId}`);

        // Notify the other party that this user has left the room
        socket.to(conversationRoom(conversationId)).emit("user_presence", {
          conversationId,
          callerType,
          isOnline: false,
        });
      }
    });

    // ── send_message ────────────────────────────────────────────────────────
    socket.on("send_message", async ({ conversationId, text, tempId } = {}) => {
      try {
        if (!conversationId) {
          return socket.emit("message_error", {
            tempId,
            error: "conversationId is required.",
          });
        }

        const trimmedText = (text ?? "").trim();
        if (!trimmedText) {
          return socket.emit("message_error", {
            tempId,
            error: "Message text cannot be empty. For images use the REST endpoint.",
          });
        }

        if (trimmedText.length > 2000) {
          return socket.emit("message_error", {
            tempId,
            error: "Message text cannot exceed 2000 characters.",
          });
        }

        // Verify participant and conversation status
        const conv = await Conversation.findById(conversationId);
        if (!conv) {
          return socket.emit("message_error", { tempId, error: "Conversation not found." });
        }

        const isParticipant =
          (callerType === "customer" && conv.customer.toString() === callerId) ||
          (callerType === "partner"  && conv.partner.toString()  === callerId);

        if (!isParticipant) {
          return socket.emit("message_error", {
            tempId,
            error: "You are not a participant in this conversation.",
          });
        }

        if (conv.status === "closed") {
          return socket.emit("message_error", {
            tempId,
            error: "This conversation has been closed.",
          });
        }

        // Persist the message — post-save hook updates lastMessage + unread counter
        const message = await Message.create({
          conversation: conversationId,
          senderType:   callerType,
          sender:       callerId,
          text:         trimmedText,
        });

        const messageObj = message.toObject();

        // Ack to the sender (so they can swap the optimistic bubble for the real one)
        socket.emit("message_sent", { message: messageObj, tempId });

        // Broadcast to everyone else in the room (the recipient)
        socket.to(conversationRoom(conversationId)).emit("new_message", {
          message: messageObj,
        });
      } catch (err) {
        console.error("[Socket] send_message error:", err.message);
        socket.emit("message_error", { tempId, error: "Failed to send message." });
      }
    });

    // ── typing_start ────────────────────────────────────────────────────────
    socket.on("typing_start", ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.to(conversationRoom(conversationId)).emit("typing_start", {
        conversationId,
        callerType,
        callerId,
      });
    });

    // ── typing_stop ─────────────────────────────────────────────────────────
    socket.on("typing_stop", ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.to(conversationRoom(conversationId)).emit("typing_stop", {
        conversationId,
        callerType,
        callerId,
      });
    });

    // ── mark_read ───────────────────────────────────────────────────────────
    socket.on("mark_read", async ({ conversationId } = {}) => {
      try {
        if (!conversationId) return;

        const conv = await verifyParticipant(conversationId, callerId, callerType);
        if (!conv) return;

        const oppositeType = callerType === "customer" ? "partner" : "customer";
        const unreadField  = callerType === "customer" ? "unreadByCustomer" : "unreadByPartner";

        await Promise.all([
          Message.updateMany(
            { conversation: conversationId, senderType: oppositeType, isRead: false },
            { isRead: true, readAt: new Date() }
          ),
          Conversation.findByIdAndUpdate(conversationId, { [unreadField]: 0 }),
        ]);

        // Notify the other party that their messages were read
        namespace.to(conversationRoom(conversationId)).emit("messages_read", {
          conversationId,
          readBy: callerType,
        });
      } catch (err) {
        console.error("[Socket] mark_read error:", err.message);
      }
    });

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`[Socket] disconnected — ${callerType}:${callerId}  reason: ${reason}`);

      // Notify all conversation rooms this socket was in that the user went offline
      for (const room of socket.rooms) {
        if (room.startsWith("conv:")) {
          const conversationId = room.slice(5); // strip "conv:" prefix
          namespace.to(room).emit("user_presence", {
            conversationId,
            callerType,
            isOnline: false,
          });
        }
      }
    });
  });
};

// ─── Utility: emit from REST controllers ─────────────────────────────────────
/**
 * emitNewMessage(io, conversationId, message)
 *
 * Called by the REST sendMessage controller after a message is persisted
 * (e.g. when the client uploads an image via multipart/form-data).
 * Broadcasts `new_message` into the conversation room so both parties
 * receive image messages in real time even though they came via REST.
 *
 * @param {import("socket.io").Server} io
 * @param {string} conversationId
 * @param {object} message  — plain message object (toObject() result)
 */
export const emitNewMessage = (io, conversationId, message) => {
  io.of("/chat")
    .to(conversationRoom(conversationId))
    .emit("new_message", { message });
};
