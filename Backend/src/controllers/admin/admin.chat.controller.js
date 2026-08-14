import Conversation from "../../models/chat/Conversation.js";
import Message from "../../models/chat/Message.js";

// ─── ADMIN: Get all conversations for a specific partner ─────────────────────
/**
 * GET /api/admin/partners/:partnerId/conversations
 * 🔒 admin_token
 *
 * Query params:
 *   page  : number (default 1)
 *   limit : number (default 20)
 *
 * Returns all conversations where the given partner is a participant,
 * sorted by most recent message first, regardless of soft-delete flags.
 */
export const adminGetPartnerConversations = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const [conversations, total] = await Promise.all([
      Conversation.find({ partner: partnerId })
        .sort({ "lastMessage.sentAt": -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customer", "fullName profilePhoto phone")
        .populate("partner",  "fullName profilePhoto phone")
        .populate("booking",  "status scheduledAt")
        .lean(),
      Conversation.countDocuments({ partner: partnerId }),
    ]);

    return res.status(200).json({
      conversations,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("adminGetPartnerConversations error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── ADMIN: Get all conversations (platform-wide) ────────────────────────────
/**
 * GET /api/admin/conversations
 * 🔒 admin_token
 *
 * Query params:
 *   page     : number (default 1)
 *   limit    : number (default 20)
 *   search   : string — filters by partner or customer fullName (case-insensitive)
 *   status   : "active" | "closed"
 *
 * Returns all conversations across the platform for overview/moderation.
 */
export const adminGetAllConversations = async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status ?? null;

    const filter = {};
    if (status) filter.status = status;

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ "lastMessage.sentAt": -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customer", "fullName profilePhoto phone")
        .populate("partner",  "fullName profilePhoto phone")
        .populate("booking",  "status scheduledAt")
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    return res.status(200).json({
      conversations,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("adminGetAllConversations error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── ADMIN: Get messages in a conversation ────────────────────────────────────
/**
 * GET /api/admin/conversations/:conversationId/messages
 * 🔒 admin_token
 *
 * Query params:
 *   page  : number (default 1)
 *   limit : number (default 50)
 *
 * Returns all messages (including soft-deleted ones, flagged with isDeleted)
 * so admins can see the full unredacted thread for moderation.
 */
export const adminGetConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const conversation = await Conversation.findById(conversationId)
      .populate("customer", "fullName profilePhoto phone")
      .populate("partner",  "fullName profilePhoto phone")
      .populate("booking",  "status scheduledAt description")
      .lean();

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const [messages, total] = await Promise.all([
      // Admin sees ALL messages including soft-deleted ones
      Message.find({ conversation: conversationId })
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversation: conversationId }),
    ]);

    return res.status(200).json({
      conversation,
      messages,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("adminGetConversationMessages error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── ADMIN: Close a conversation ──────────────────────────────────────────────
/**
 * PATCH /api/admin/conversations/:conversationId/close
 * 🔒 admin_token
 *
 * Sets the conversation status to "closed" so neither party can send
 * further messages (the sendMessage controller checks for this).
 * Useful for moderation — e.g. after a dispute is resolved.
 */
export const adminCloseConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    if (conversation.status === "closed") {
      return res.status(400).json({ message: "Conversation is already closed." });
    }

    conversation.status = "closed";
    await conversation.save();

    return res.status(200).json({
      message: "Conversation closed.",
      conversationId: conversation._id,
      status: conversation.status,
    });
  } catch (error) {
    console.error("adminCloseConversation error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
