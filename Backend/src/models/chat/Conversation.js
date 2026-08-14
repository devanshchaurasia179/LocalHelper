import mongoose from "mongoose";

/**
 * Conversation document — one document per unique customer ↔ partner pair.
 *
 * A conversation is lazily created the first time either party sends a message.
 * The (customer, partner) pair is unique so there's always at most one thread
 * between any two users.
 *
 * lastMessage is a lightweight snapshot kept in sync by the Message post-save
 * hook, so listing conversations doesn't require an extra aggregation step.
 */
const conversationSchema = new mongoose.Schema(
  {
    // ── Parties ───────────────────────────────────────────────────────────────
    customer: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Customer",
      required: true,
      index:    true,
    },
    partner: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Partner",
      required: true,
      index:    true,
    },

    // ── Optional booking context ──────────────────────────────────────────────
    // If the chat was initiated from a booking screen, link it here.
    // Not required — conversations can start independently of a booking.
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Booking",
      default: null,
    },

    // ── Last message snapshot (denormalised for list screens) ─────────────────
    lastMessage: {
      text:      { type: String, default: "" },
      sentAt:    { type: Date,   default: null },
      // Who sent the last message — used to show "You: …" in the list
      senderType: {
        type:    String,
        enum:    ["customer", "partner"],
        default: null,
      },
    },

    // ── Unread counters ───────────────────────────────────────────────────────
    // Incremented when a message arrives; reset to 0 when the recipient opens
    // the conversation.
    unreadByCustomer: { type: Number, default: 0 },
    unreadByPartner:  { type: Number, default: 0 },

    // ── Soft-delete / archive per party ──────────────────────────────────────
    // Either side can "delete" the thread from their own inbox without
    // affecting the other party's view.
    deletedByCustomer: { type: Boolean, default: false },
    deletedByPartner:  { type: Boolean, default: false },

    // ── Status ────────────────────────────────────────────────────────────────
    // active  : normal conversation
    // closed  : e.g. booking completed; further messaging disabled
    status: {
      type:    String,
      enum:    ["active", "closed"],
      default: "active",
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Enforce one thread per customer–partner pair
conversationSchema.index({ customer: 1, partner: 1 }, { unique: true });

// Fetch all conversations for a customer, newest activity first
conversationSchema.index({ customer: 1, "lastMessage.sentAt": -1 });

// Fetch all conversations for a partner, newest activity first
conversationSchema.index({ partner: 1, "lastMessage.sentAt": -1 });

// ─── Model ────────────────────────────────────────────────────────────────────

export default mongoose.model("Conversation", conversationSchema);
