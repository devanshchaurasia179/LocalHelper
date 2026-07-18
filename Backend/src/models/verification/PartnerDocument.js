import mongoose from "mongoose";

/**
 * PartnerDocument
 *
 * One record per uploaded document per partner. This is intentionally a
 * separate collection from Partner for three reasons:
 *
 * 1. Queryability — admin needs to query "all Aadhaar docs under review"
 *    across all partners. Impossible efficiently with embedded arrays.
 *
 * 2. Version history — when a partner re-uploads a rejected document, we
 *    archive the old record (status → Superseded) and insert a new one.
 *    This gives a full audit trail of every upload without data loss.
 *
 * 3. Index efficiency — compound indexes on (partnerId, documentTypeId, status)
 *    make the partner verification fetch and admin review queries O(log n).
 *
 * ─── Active record rule ──────────────────────────────────────────────────────
 * At any time, only ONE record per (partnerId + documentTypeId + side) should
 * have status != "Superseded". This is the "active" upload for that slot.
 * All previous uploads for the same slot have status = "Superseded".
 *
 * ─── Multi-page documents (e.g., Aadhaar) ───────────────────────────────────
 * Aadhaar has front and back. Two PartnerDocument records are created,
 * both with the same documentTypeId, differentiated by the `side` field:
 *   side: "front"  — Aadhaar front
 *   side: "back"   — Aadhaar back
 *   side: "single" — any document that is not multi-page (default)
 */
const partnerDocumentSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: [true, "partnerId is required."],
      index: true,
    },

    documentTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocumentType",
      required: [true, "documentTypeId is required."],
    },

    // ── Multi-page side ───────────────────────────────────────────────────────
    // "single" for non-multi-page documents (selfie, police verification, etc.)
    // "front" / "back" for Aadhaar-style documents
    side: {
      type: String,
      enum: ["single", "front", "back"],
      default: "single",
    },

    // ── Upload status ─────────────────────────────────────────────────────────
    // Pending      — uploaded by partner, not yet submitted for review
    //                (reserved for future "save draft" feature)
    // Under Review — submitted, awaiting admin action
    // Approved     — admin approved this specific document
    // Rejected     — admin rejected this specific document
    // Superseded   — this record was replaced by a newer upload
    status: {
      type: String,
      enum: ["Pending", "Under Review", "Approved", "Rejected", "Superseded"],
      default: "Under Review",
      index: true,
    },

    // ── Cloudinary asset ──────────────────────────────────────────────────────
    // Stored as a sub-document for easy access to both URL and publicId.
    // publicId is needed to delete the old asset from Cloudinary on re-upload.
    cloudinary: {
      url:      { type: String, required: true },
      publicId: { type: String, required: true },
      format:   { type: String },
      width:    { type: Number },
      height:   { type: Number },
      bytes:    { type: Number },
    },

    // ── Number value ──────────────────────────────────────────────────────────
    // Populated only when DocumentType.hasNumberField is true.
    // Example: "123456789012" for Aadhaar, "ABCDE1234F" for PAN.
    // Stored uppercase, validated against DocumentType.numberFieldValidationRegex.
    numberValue: {
      type: String,
      trim: true,
      default: null,
    },

    // ── Version tracking ──────────────────────────────────────────────────────
    // Starts at 1 on first upload, increments on every re-upload.
    // Useful for admin to know "this is the 3rd time the partner re-uploaded."
    version: {
      type: Number,
      default: 1,
      min: 1,
    },

    // ── Rejection audit ──────────────────────────────────────────────────────
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    // ── Approval audit ────────────────────────────────────────────────────────
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    // ── Upload timestamp ──────────────────────────────────────────────────────
    // createdAt (from timestamps: true) = when this record was inserted.
    // uploadedAt = explicitly set to now on creation, preserved on updates.
    // Using both gives flexibility: createdAt is immutable, uploadedAt is semantic.
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // adds createdAt (immutable) and updatedAt
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────

// Primary query pattern: fetch all active documents for a partner
// Used in GET /partner/verification
partnerDocumentSchema.index({ partnerId: 1, status: 1 });

// Compound index for the exact active-slot lookup:
// "Find the active upload for partner X, document type Y, side Z"
// Used before every new upload to find and supersede the previous record
partnerDocumentSchema.index(
  { partnerId: 1, documentTypeId: 1, side: 1, status: 1 }
);

// Admin query: "show me all Aadhaar documents currently Under Review"
partnerDocumentSchema.index({ documentTypeId: 1, status: 1 });

// Admin query: "show all documents uploaded today"
partnerDocumentSchema.index({ uploadedAt: -1 });

export default mongoose.model("PartnerDocument", partnerDocumentSchema);
