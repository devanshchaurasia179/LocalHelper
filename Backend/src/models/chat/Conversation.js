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

    // ── Chat Payment & Time Tracking ──────────────────────────────────────────
    // Time-based messaging: customer pays ₹10 per minute of chat access
    activeUntil: {
      type:    Date,
      default: null,
      // When null or past, customer cannot send messages until they purchase more time
    },

    totalPaidMinutes: {
      type:    Number,
      default: 0,
      // Cumulative minutes purchased for this conversation
    },

    // Track when conversation screen is opened/closed to measure actual usage
    sessionHistory: [{
      openedAt:  { type: Date, required: true },
      closedAt:  { type: Date, default: null },
      // If closedAt is null, session is still active
    }],

    // Current active session (for quick lookup)
    currentSessionStart: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Check if customer has active paid chat time remaining
 */
conversationSchema.methods.hasActiveChatTime = function() {
  if (!this.activeUntil) return false;
  return new Date() < new Date(this.activeUntil);
};

/**
 * Get remaining chat time in seconds (0 if expired)
 */
conversationSchema.methods.getRemainingSeconds = function() {
  if (!this.activeUntil) return 0;
  const remaining = Math.floor((new Date(this.activeUntil) - new Date()) / 1000);
  return Math.max(0, remaining);
};

/**
 * Add paid minutes to the conversation
 * @param {number} minutes - Number of minutes to add
 * @returns {Date} - New activeUntil timestamp
 */
conversationSchema.methods.addChatTime = function(minutes) {
  const now = new Date();
  const currentActiveUntil = this.activeUntil ? new Date(this.activeUntil) : now;
  
  // If activeUntil is in the past, start from now; otherwise extend from activeUntil
  const startFrom = currentActiveUntil > now ? currentActiveUntil : now;
  
  this.activeUntil = new Date(startFrom.getTime() + minutes * 60 * 1000);
  this.totalPaidMinutes = (this.totalPaidMinutes || 0) + minutes;
  
  return this.activeUntil;
};

/**
 * Start a new session (when customer opens conversation screen)
 */
conversationSchema.methods.startSession = function() {
  const now = new Date();
  
  // Only start session if there isn't already an active one
  if (!this.currentSessionStart) {
    this.currentSessionStart = now;
    this.sessionHistory.push({ openedAt: now, closedAt: null });
  }
};

/**
 * End current session (when customer closes/leaves conversation screen)
 */
conversationSchema.methods.endSession = function() {
  if (!this.currentSessionStart) return;
  
  const now = new Date();
  
  // Find the last session without closedAt and update it
  const lastSession = this.sessionHistory[this.sessionHistory.length - 1];
  if (lastSession && !lastSession.closedAt) {
    lastSession.closedAt = now;
  }
  
  this.currentSessionStart = null;
};

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Enforce one thread per customer–partner pair
conversationSchema.index({ customer: 1, partner: 1 }, { unique: true });

// Fetch all conversations for a customer, newest activity first
conversationSchema.index({ customer: 1, "lastMessage.sentAt": -1 });

// Fetch all conversations for a partner, newest activity first
conversationSchema.index({ partner: 1, "lastMessage.sentAt": -1 });

// Query conversations by activeUntil for expiry checks
conversationSchema.index({ activeUntil: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

export default mongoose.model("Conversation", conversationSchema);
