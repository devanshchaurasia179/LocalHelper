import mongoose from "mongoose";

// ─── Sub-schema: snapshotted address at the time of booking ──────────────────
// We snapshot the customer's address so historical records stay accurate
// even if the customer later edits or deletes the address.
const addressSnapshot = {
  _id: false,
  house:    String,
  street:   String,
  locality: String,
  city:     { type: String, required: true },
  state:    { type: String, required: true },
  pincode:  String,
  // GeoJSON point — [longitude, latitude] captured at booking time
  coordinates: {
    type:        { type: String, enum: ["Point"] },
    coordinates: [Number],
  },
};

// ─── Sub-schema: customer review left after job completion ───────────────────
const reviewSchema = {
  _id: false,
  rating:    { type: Number, min: 1, max: 5 },        // 1–5 stars
  comment:   { type: String, trim: true, maxlength: 500 },
  createdAt: { type: Date,   default: Date.now },
};

// ─── Sub-schema: cancellation metadata ───────────────────────────────────────
const cancellationSchema = {
  _id: false,
  cancelledBy: {
    type: String,
    enum: ["customer", "partner"],
  },
  reason:      { type: String, trim: true, maxlength: 300 },
  cancelledAt: { type: Date, default: Date.now },
};

// ─── Main Booking Schema ─────────────────────────────────────────────────────

/**
 * Booking document — one document per service request.
 *
 * Status lifecycle:
 *
 *   pending  ──► accepted ──► in_progress ──► completed
 *      │              │
 *      └──► cancelled └──► cancelled
 *
 *   • pending     : customer raised the request; awaiting partner action
 *   • accepted    : partner confirmed; job not yet started
 *   • in_progress : partner has started the work
 *   • completed   : work finished and marked done by partner
 *   • cancelled   : cancelled by either party before completion
 */
const bookingSchema = new mongoose.Schema(
  {
    // ── Parties ─────────────────────────────────────────────────────────────
    partner: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Partner",
      required: true,
      index:    true,
    },
    customer: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Customer",
      required: true,
      index:    true,
    },

    // ── Service context ──────────────────────────────────────────────────────
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Category",
    },
    // Free-text description of what the customer needs
    description: {
      type:      String,
      trim:      true,
      maxlength: 1000,
    },

    // ── Scheduling ───────────────────────────────────────────────────────────
    scheduledAt: {
      type:     Date,
      required: true,
    },
    // Actual timestamps set by partner actions
    startedAt:   Date,
    completedAt: Date,

    // ── Location ─────────────────────────────────────────────────────────────
    // Snapshot of the customer's address at booking time
    serviceAddress: addressSnapshot,

    // ── Pricing ──────────────────────────────────────────────────────────────
    visitingCredit:     Number,

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ["pending", "accepted", "in_progress", "completed", "cancelled"],
      default: "pending",
      index:   true,
    },

    // ── Cancellation ─────────────────────────────────────────────────────────
    cancellation: cancellationSchema,

    // ── Review ───────────────────────────────────────────────────────────────
    // Left by customer after job is completed
    review: reviewSchema,

    // ── Flags ────────────────────────────────────────────────────────────────
    isEmergency: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

// Most common query: partner's bookings filtered by status, newest first
bookingSchema.index({ partner: 1, status: 1, createdAt: -1 });

// Customer's booking history
bookingSchema.index({ customer: 1, createdAt: -1 });


// ─── Model ───────────────────────────────────────────────────────────────────

export default mongoose.model("Booking", bookingSchema);
