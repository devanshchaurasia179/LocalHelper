import mongoose from "mongoose";

/**
 * VerificationSession
 *
 * The authoritative record of a partner's overall verification lifecycle.
 *
 * ─── Why this exists separately from Partner.verificationStatus ──────────────
 * Partner.verificationStatus is a DENORMALIZED CACHE of the latest session
 * status. It exists purely for fast admin list queries — querying 10,000
 * partners by status without joining VerificationSession.
 *
 * VerificationSession is the SOURCE OF TRUTH. It stores:
 *   - The complete history of every status change
 *   - Who made each change and when
 *   - What documents were required at submission time (snapshot)
 *   - Admin review notes
 *
 * ─── Multi-cycle support ──────────────────────────────────────────────────────
 * A partner may go through multiple verification cycles:
 *   Cycle 1: Submit → Admin Reject → Partner Re-submits
 *   Cycle 2: Submit → Admin Approve
 *
 * Each cycle is a separate VerificationSession record. The latest session
 * (by createdAt) is always the active one. Previous sessions are preserved
 * for audit and compliance purposes.
 *
 * ─── Relationship to PartnerDocument ─────────────────────────────────────────
 * VerificationSession does NOT embed document records. PartnerDocument is
 * its own collection. The connection is through partnerId on both models.
 * When admin reviews a session, they query PartnerDocument by partnerId.
 *
 * ─── The `requiredDocumentsSnapshot` field ───────────────────────────────────
 * This is important for compliance: when the partner submitted, which document
 * types were required? If an admin adds a new required document type after
 * the partner submitted, it should NOT retroactively change what was required
 * for this existing session. The snapshot captures the requirements at the
 * moment of submission.
 */

// ─── History entry sub-schema ─────────────────────────────────────────────────
const historyEntrySchema = new mongoose.Schema(
  {
    // The status that was SET by this action
    status: {
      type: String,
      enum: [
        "Pending",
        "In Progress",
        "Under Review",
        "Approved",
        "Rejected",
        "Re-submitted",
      ],
      required: true,
    },

    // Who made the change: "partner" (submitted/re-submitted) or Admin ObjectId
    changedBy: {
      type: mongoose.Schema.Types.Mixed,
      // Either the string "partner" or an Admin ObjectId
      // Using Mixed to support both without a union type
      required: true,
    },

    changedByRole: {
      type: String,
      enum: ["partner", "admin"],
      required: true,
    },

    // Admin name or "Partner" — denormalized for fast history display
    // without populating every entry
    changedByName: {
      type: String,
      default: "",
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },

    // Optional: admin review notes, rejection reasons for the overall session
    note: {
      type: String,
      default: "",
    },
  },
  { _id: false } // No separate _id for history entries — they are value objects
);

// ─── Main schema ──────────────────────────────────────────────────────────────
const verificationSessionSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: [true, "partnerId is required."],
      index: true,
    },

    // ── Overall status ────────────────────────────────────────────────────────
    // Pending      — session created, partner has not submitted yet
    // In Progress  — partner has uploaded some but not all required documents
    // Under Review — all required documents submitted, awaiting admin review
    // Approved     — admin approved the entire verification
    // Rejected     — admin rejected (with notes on which documents failed)
    // Re-submitted — partner re-uploaded after rejection, back to Under Review
    overallStatus: {
      type: String,
      enum: [
        "Pending",
        "In Progress",
        "Under Review",
        "Approved",
        "Rejected",
        "Re-submitted",
      ],
      default: "Pending",
      index: true,
    },

    // ── Timestamps ────────────────────────────────────────────────────────────
    submittedAt: {
      type: Date,
      default: null,
      // Set when partner triggers the verification submission
    },

    completedAt: {
      type: Date,
      default: null,
      // Set when admin approves or finally rejects
    },

    // ── Admin review ──────────────────────────────────────────────────────────
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    // Admin's summary note for this session (e.g., "All docs clear, approved")
    reviewNotes: {
      type: String,
      default: "",
    },

    // ── Required documents snapshot ───────────────────────────────────────────
    // Array of DocumentType ObjectIds that were required when this session
    // was submitted. Captured as a snapshot so retroactive config changes
    // do not affect in-progress verifications.
    //
    // This is the definitive list the admin will check against.
    // After submission, this list is frozen — admin cannot change it
    // without creating a new session.
    requiredDocumentsSnapshot: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "DocumentType" }],
      default: [],
    },

    // ── Complete status history ───────────────────────────────────────────────
    // Every status change is appended here. Never deleted.
    // Provides a full audit trail for compliance and dispute resolution.
    history: {
      type: [historyEntrySchema],
      default: [],
    },

    // ── Session number ────────────────────────────────────────────────────────
    // 1 for first submission, 2 for re-submission after rejection, etc.
    // Used for display: "Verification Attempt #2"
    sessionNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────

// Most common query: get the active (latest) session for a partner
verificationSessionSchema.index({ partnerId: 1, overallStatus: 1 });

// Admin dashboard: all pending/under-review sessions, sorted by submission time
verificationSessionSchema.index({ overallStatus: 1, submittedAt: 1 });

// Admin throughput metrics: sessions completed in a date range
verificationSessionSchema.index({ completedAt: -1 });

export default mongoose.model("VerificationSession", verificationSessionSchema);
