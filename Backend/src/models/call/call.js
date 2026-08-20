import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
      index: true,
    },

    roomName: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: [
        "ringing",
        "accepted",
        "rejected",
        "missed",
        "ongoing",
        "completed",
        "cancelled",
        "failed",
      ],
      default: "ringing",
      index: true,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number,
      default: 0,
    },

    // Who initiated the call: "customer" or "partner"
    // Partner-initiated calls are unlimited (no time deduction).
    initiatedBy: {
      type: String,
      enum: ["customer", "partner"],
      default: "customer",
    },

    // Allowed talk time (in seconds) for this call.
    // Set from customer's callBalance when customer initiates a call.
    // null = unlimited (partner-initiated calls).
    allowedTime: {
      type: Number,
      default: null,
    },

    // ── Recording (LiveKit Egress → Cloudflare R2) ───────────────────────────
    recording: {
      egressId: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: [
          "not_started",
          "starting",
          "recording",
          "processing",
          "completed",
          "failed",
        ],
        default: "not_started",
      },
      storageProvider: {
        type: String,
        default: "r2",
      },
      objectKey: {
        type: String,
        default: null,
      },
      durationSeconds: {
        type: Number,
        default: null,
      },
      startedAt: {
        type: Date,
        default: null,
      },
      completedAt: {
        type: Date,
        default: null,
      },
      error: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Call = mongoose.model("Call", callSchema);

export default Call;