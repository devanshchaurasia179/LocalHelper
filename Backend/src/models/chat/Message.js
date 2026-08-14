import mongoose from "mongoose";

/**
 * Message document — one document per chat message.
 *
 * Each message belongs to a Conversation. The senderType + sender pair
 * identifies who sent it without needing a polymorphic ref helper.
 *
 * After every save, a post-save hook updates the parent Conversation's
 * lastMessage snapshot and increments the appropriate unread counter.
 */
const messageSchema = new mongoose.Schema(
  {
    // ── Parent conversation ───────────────────────────────────────────────────
    conversation: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Conversation",
      required: true,
      index:    true,
    },

    // ── Sender (polymorphic) ──────────────────────────────────────────────────
    senderType: {
      type:     String,
      enum:     ["customer", "partner"],
      required: true,
    },
    sender: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      // refPath not used here to keep queries simple;
      // senderType is sufficient for all current use-cases.
    },

    // ── Content ───────────────────────────────────────────────────────────────
    // At least one of text / mediaUrl must be present (enforced in controller).
    text: {
      type:    String,
      trim:    true,
      default: "",
    },

    // For image / file attachments uploaded via Cloudinary (or similar)
    mediaUrl:  { type: String, default: null },
    mediaType: {
      type:    String,
      enum:    ["image", "file", null],
      default: null,
    },

    // ── Read receipt ──────────────────────────────────────────────────────────
    isRead:  { type: Boolean, default: false },
    readAt:  { type: Date,    default: null },

    // ── Soft delete ───────────────────────────────────────────────────────────
    // Deleted messages are hidden in the UI but retained for audit purposes.
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Fetch messages in a conversation ordered by time (most common query)
messageSchema.index({ conversation: 1, createdAt: 1 });

// Efficiently count / fetch unread messages per conversation
messageSchema.index({ conversation: 1, isRead: 1 });

// ─── Post-save hook ───────────────────────────────────────────────────────────
// Keep the parent Conversation's lastMessage snapshot and unread counters
// in sync without requiring an extra round-trip from the controller.

messageSchema.post("save", async function (doc) {
  try {
    const Conversation = mongoose.model("Conversation");

    // Determine which counter to increment
    const unreadField =
      doc.senderType === "customer" ? "unreadByPartner" : "unreadByCustomer";

    await Conversation.findByIdAndUpdate(doc.conversation, {
      lastMessage: {
        text:       doc.text || (doc.mediaType ? `[${doc.mediaType}]` : ""),
        sentAt:     doc.createdAt,
        senderType: doc.senderType,
      },
      $inc: { [unreadField]: 1 },
    });
  } catch (err) {
    // Non-fatal — log and move on; the message itself was saved successfully.
    console.error("[Message post-save] failed to update conversation:", err.message);
  }
});

// ─── Model ────────────────────────────────────────────────────────────────────

export default mongoose.model("Message", messageSchema);
