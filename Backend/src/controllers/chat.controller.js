import Conversation from "../models/chat/Conversation.js";
import Message from "../models/chat/Message.js";
import Customer from "../models/customer/Customer.js";
import Partner from "../models/partner/Partner.js";
import { uploadToCloudinary } from "../middleware/upload.middleware.js";
import { getIO } from "../socket/index.js";
import { emitNewMessage } from "../socket/chat.socket.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve caller identity from the request.
 * Auth middleware sets req.customerId OR req.partnerId (or both in dev).
 * Returns { callerId, callerType } or null when neither is set.
 */
const resolveCaller = (req) => {
  if (req.customerId) return { callerId: req.customerId, callerType: "customer" };
  if (req.partnerId)  return { callerId: req.partnerId,  callerType: "partner"  };
  return null;
};

/**
 * Ensure req.body is safely parsed when the request is multipart/form-data.
 * For multipart requests, JSON fields arrive as strings — coerce as needed.
 */
const getTextField = (req) => (req.body?.text ?? "").trim();

// ─── GET OR CREATE CONVERSATION ───────────────────────────────────────────────
/**
 * POST /api/chat/conversations
 * 🔒 customer_token  OR  partner_token
 *
 * Body:
 * {
 *   partnerId  : "ObjectId"   (required when caller is customer)
 *   customerId : "ObjectId"   (required when caller is partner)
 *   bookingId  : "ObjectId"   (optional)
 * }
 *
 * Idempotent — returns the existing conversation if one already exists
 * between the pair.
 */
export const getOrCreateConversation = async (req, res) => {
  try {
    const caller = resolveCaller(req);
    if (!caller) {
      return res.status(401).json({ message: "Unauthorised." });
    }

    const { callerType, callerId } = caller;

    // Build the customer / partner IDs from caller context + body
    let customerId, partnerId;

    if (callerType === "customer") {
      customerId = callerId;
      partnerId  = req.body.partnerId;
      if (!partnerId) {
        return res.status(400).json({ message: "partnerId is required." });
      }
    } else {
      partnerId  = callerId;
      customerId = req.body.customerId;
      if (!customerId) {
        return res.status(400).json({ message: "customerId is required." });
      }
    }

    const bookingId = req.body.bookingId ?? null;

    // findOneAndUpdate with upsert gives us an atomic get-or-create
    const conversation = await Conversation.findOneAndUpdate(
      { customer: customerId, partner: partnerId },
      {
        $setOnInsert: {
          customer:  customerId,
          partner:   partnerId,
          booking:   bookingId,
          status:    "active",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .populate("customer", "name profilePhoto phone")
      .populate("partner",  "fullName profilePhoto phone");

    return res.status(200).json({ conversation });
  } catch (error) {
    console.error("getOrCreateConversation error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET MY CONVERSATIONS ─────────────────────────────────────────────────────
/**
 * GET /api/chat/conversations
 * 🔒 customer_token  OR  partner_token
 *
 * Returns all non-deleted conversations for the caller, sorted by
 * most recent message first.
 */
export const getMyConversations = async (req, res) => {
  try {
    const caller = resolveCaller(req);
    if (!caller) {
      return res.status(401).json({ message: "Unauthorised." });
    }

    const { callerType, callerId } = caller;

    // Build filter — exclude conversations the caller has soft-deleted
    const filter =
      callerType === "customer"
        ? { customer: callerId, deletedByCustomer: false }
        : { partner:  callerId, deletedByPartner:  false };

    const conversations = await Conversation.find(filter)
      .sort({ "lastMessage.sentAt": -1 })
      .populate("customer", "name profilePhoto")
      .populate("partner",  "fullName profilePhoto")
      .populate("booking",  "status scheduledAt")
      .lean();

    // Attach the caller-specific unread count to each conversation
    const enriched = conversations.map((conv) => ({
      ...conv,
      unreadCount:
        callerType === "customer" ? conv.unreadByCustomer : conv.unreadByPartner,
    }));

    return res.status(200).json({ conversations: enriched });
  } catch (error) {
    console.error("getMyConversations error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET MESSAGES IN A CONVERSATION ──────────────────────────────────────────
/**
 * GET /api/chat/conversations/:conversationId/messages
 * 🔒 customer_token  OR  partner_token
 *
 * Query params:
 *   page  : number (default 1)
 *   limit : number (default 30)
 *
 * Messages are returned oldest → newest (natural chat order).
 * Also marks all unread messages as read for the caller.
 */
export const getMessages = async (req, res) => {
  try {
    const caller = resolveCaller(req);
    if (!caller) {
      return res.status(401).json({ message: "Unauthorised." });
    }

    const { callerType, callerId } = caller;
    const { conversationId } = req.params;
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    // Load conversation and verify the caller is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const isParticipant =
      (callerType === "customer" && conversation.customer.toString() === callerId) ||
      (callerType === "partner"  && conversation.partner.toString()  === callerId);

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorised to view this conversation." });
    }

    const [messages, total] = await Promise.all([
      Message.find({ conversation: conversationId, isDeleted: false })
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversation: conversationId, isDeleted: false }),
    ]);

    // ── Mark unread messages as read ──────────────────────────────────────
    // Only mark messages sent by the OTHER party as read
    const oppositeType = callerType === "customer" ? "partner" : "customer";

    const readResult = await Message.updateMany(
      {
        conversation: conversationId,
        senderType:   oppositeType,
        isRead:       false,
      },
      { isRead: true, readAt: new Date() }
    );

    // Reset the caller's unread counter on the conversation
    if (readResult.modifiedCount > 0) {
      const unreadField = callerType === "customer" ? "unreadByCustomer" : "unreadByPartner";
      await Conversation.findByIdAndUpdate(conversationId, {
        [unreadField]: 0,
      });
    }

    return res.status(200).json({
      messages,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getMessages error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── SEND A MESSAGE (text or image) ──────────────────────────────────────────
/**
 * POST /api/chat/conversations/:conversationId/messages
 * 🔒 customer_token  OR  partner_token
 *
 * Content-Type: multipart/form-data  (when sending an image)
 *   Fields:
 *     text   : string  (optional, max 2000 chars)
 *     image  : file    (optional — JPEG/PNG/WEBP, max 5 MB via upload middleware)
 *
 * Content-Type: application/json  (when sending text only)
 *   Body: { text }
 *
 * At least one of text or image is required.
 * The Message post-save hook keeps the Conversation's lastMessage + unread
 * counters in sync automatically.
 */
export const sendMessage = async (req, res) => {
  try {
    const caller = resolveCaller(req);
    if (!caller) {
      return res.status(401).json({ message: "Unauthorised." });
    }

    const { callerType, callerId } = caller;
    const { conversationId } = req.params;

    const text      = getTextField(req);
    const imageFile = req.file ?? null; // set by upload.single("image") on the route

    // Validate: at least one of text or image must be present
    if (!text && !imageFile) {
      return res.status(400).json({
        message: "Message must contain text or an image.",
      });
    }

    if (text.length > 2000) {
      return res.status(400).json({
        message: "Message text cannot exceed 2000 characters.",
      });
    }

    // Load conversation and verify the caller is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const isParticipant =
      (callerType === "customer" && conversation.customer.toString() === callerId) ||
      (callerType === "partner"  && conversation.partner.toString()  === callerId);

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorised to send to this conversation." });
    }

    if (conversation.status === "closed") {
      return res.status(400).json({
        message: "This conversation has been closed and no longer accepts messages.",
      });
    }

    // ── Block check: prevent messaging if either party has blocked the other ──
    const customerId = conversation.customer.toString();
    const partnerId  = conversation.partner.toString();

    const customer = await Customer.findById(customerId).select("blockedPartners").lean();
    const partner  = await Partner.findById(partnerId).select("blockedCustomers").lean();

    if (customer?.blockedPartners?.some((id) => id.toString() === partnerId)) {
      return res.status(403).json({
        message: "You have blocked this partner. Unblock to send messages.",
      });
    }
    if (partner?.blockedCustomers?.some((id) => id.toString() === customerId)) {
      return res.status(403).json({
        message: "You cannot send messages to this partner.",
      });
    }

    // ── Upload image to Cloudinary if present ─────────────────────────────
    let mediaUrl  = null;
    let mediaType = null;

    if (imageFile) {
      const folder = `chat/${conversationId}`;
      const result = await uploadToCloudinary(imageFile.buffer, folder);
      mediaUrl  = result.url;
      mediaType = "image";
    }

    // ── Create the message ────────────────────────────────────────────────
    // The post-save hook on Message will update the conversation's
    // lastMessage snapshot and increment the recipient's unread counter.
    const message = await Message.create({
      conversation: conversationId,
      senderType:   callerType,
      sender:       callerId,
      text:         text || "",
      mediaUrl,
      mediaType,
    });

    // ── Real-time broadcast ───────────────────────────────────────────────
    // Text-only messages sent via socket are already broadcast inside the
    // socket handler. This call handles the image (multipart) path where
    // the client used the REST endpoint instead of the socket.
    try {
      emitNewMessage(getIO(), conversationId, message.toObject());
    } catch {
      // Socket.IO not yet initialised (e.g. test environment) — non-fatal
    }

    return res.status(201).json({ message });
  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── DELETE A MESSAGE (soft delete) ──────────────────────────────────────────
/**
 * DELETE /api/chat/messages/:messageId
 * 🔒 customer_token  OR  partner_token
 *
 * Only the sender of a message can delete it.
 * Sets isDeleted = true — message is hidden but retained in the DB.
 */
export const deleteMessage = async (req, res) => {
  try {
    const caller = resolveCaller(req);
    if (!caller) {
      return res.status(401).json({ message: "Unauthorised." });
    }

    const { callerType, callerId } = caller;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // Only the sender can delete
    if (
      message.senderType !== callerType ||
      message.sender.toString() !== callerId
    ) {
      return res.status(403).json({ message: "You can only delete your own messages." });
    }

    if (message.isDeleted) {
      return res.status(400).json({ message: "Message is already deleted." });
    }

    message.isDeleted = true;
    await message.save();

    return res.status(200).json({ message: "Message deleted." });
  } catch (error) {
    console.error("deleteMessage error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── DELETE (CLEAR) A CONVERSATION ───────────────────────────────────────────
/**
 * DELETE /api/chat/conversations/:conversationId
 * 🔒 customer_token  OR  partner_token
 *
 * Soft-deletes the conversation from the caller's inbox.
 * The other party's view is unaffected.
 */
export const deleteConversation = async (req, res) => {
  try {
    const caller = resolveCaller(req);
    if (!caller) {
      return res.status(401).json({ message: "Unauthorised." });
    }

    const { callerType, callerId } = caller;
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const isParticipant =
      (callerType === "customer" && conversation.customer.toString() === callerId) ||
      (callerType === "partner"  && conversation.partner.toString()  === callerId);

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorised to delete this conversation." });
    }

    // Set the caller-specific soft-delete flag
    const deleteField =
      callerType === "customer" ? "deletedByCustomer" : "deletedByPartner";

    await Conversation.findByIdAndUpdate(conversationId, {
      [deleteField]: true,
    });

    return res.status(200).json({ message: "Conversation removed from your inbox." });
  } catch (error) {
    console.error("deleteConversation error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── MARK CONVERSATION AS READ ────────────────────────────────────────────────
/**
 * PATCH /api/chat/conversations/:conversationId/read
 * 🔒 customer_token  OR  partner_token
 *
 * Marks all messages sent by the other party as read and resets
 * the caller's unread counter. Useful for polling-based apps where
 * getMessages isn't always called (e.g. push notification tap).
 */
export const markConversationRead = async (req, res) => {
  try {
    const caller = resolveCaller(req);
    if (!caller) {
      return res.status(401).json({ message: "Unauthorised." });
    }

    const { callerType, callerId } = caller;
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const isParticipant =
      (callerType === "customer" && conversation.customer.toString() === callerId) ||
      (callerType === "partner"  && conversation.partner.toString()  === callerId);

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorised." });
    }

    const oppositeType  = callerType === "customer" ? "partner" : "customer";
    const unreadField   = callerType === "customer" ? "unreadByCustomer" : "unreadByPartner";

    await Promise.all([
      Message.updateMany(
        { conversation: conversationId, senderType: oppositeType, isRead: false },
        { isRead: true, readAt: new Date() }
      ),
      Conversation.findByIdAndUpdate(conversationId, { [unreadField]: 0 }),
    ]);

    return res.status(200).json({ message: "Conversation marked as read." });
  } catch (error) {
    console.error("markConversationRead error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
