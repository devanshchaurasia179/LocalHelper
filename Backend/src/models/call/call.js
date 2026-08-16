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

    // Will be used in the recording phase
    recordingStatus: {
      type: String,
      enum: [
        "not_started",
        "recording",
        "completed",
        "failed",
      ],
      default: "not_started",
    },

    recordingKey: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Call = mongoose.model("Call", callSchema);

export default Call;