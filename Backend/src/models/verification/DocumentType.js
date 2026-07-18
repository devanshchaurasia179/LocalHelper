import mongoose from "mongoose";

/**
 * DocumentType
 *
 * The backend's single source of truth for every document that can ever
 * be requested from a partner. Adding a new document type (e.g., Trade License,
 * Police Verification) is a single admin API call — no code changes anywhere.
 *
 * key          — machine-readable slug used by the frontend to identify
 *               documents. Never changes once set. Example: "aadhaar_front"
 * label        — human-readable display name. Example: "Aadhaar Card (Front)"
 * description  — one-line description shown below the title in the UI
 * helpText     — longer guidance text shown as a tooltip or info section
 * uploadInstructions — step-by-step instructions shown before upload
 *
 * hasNumberField    — true for Aadhaar (12-digit number) and PAN (ABCDE1234F)
 *                     false for selfie, police verification, etc.
 * numberFieldLabel  — label for the input: "Aadhaar Number", "PAN Number"
 * numberFieldValidationRegex — stored as a string, evaluated at runtime.
 *                     Keeps validation config in the DB, not hardcoded.
 *
 * acceptedFileTypes — MIME types the partner may upload.
 *                     ["image/jpeg", "image/png"] or ["application/pdf"]
 * maxFileSizeMB     — enforced server-side before Cloudinary upload
 *
 * isRequired    — if true, partner cannot reach "Under Review" without uploading
 * isMultiPage   — true for documents that need front + back (Aadhaar)
 *                 When true, the frontend renders two upload slots
 *
 * sampleImage   — Cloudinary-hosted sample so partners know what to upload
 * icon          — icon name (from your icon set) or a URL
 * displayOrder  — controls render order in the partner app. Lower = higher up.
 *
 * isActive      — soft-disable: false hides from partner but preserves history
 * createdBy / updatedBy — admin audit trail
 *
 * requiredForCategories — optional: if populated, this document is only
 *                         required for partners in those service categories.
 *                         Empty array = required for ALL categories.
 *                         This enables category-specific document rules
 *                         without any schema changes in the future.
 */
const documentTypeSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Document type key is required."],
      unique: true,
      trim: true,
      lowercase: true,
      // Example: "aadhaar_front", "pan_card", "police_verification"
      // snake_case convention. Frontend uses this as a stable identifier.
      match: [
        /^[a-z0-9_]+$/,
        "Key must be lowercase alphanumeric with underscores only.",
      ],
    },

    label: {
      type: String,
      required: [true, "Display label is required."],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    helpText: {
      type: String,
      trim: true,
      default: "",
    },

    uploadInstructions: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Number field config ──────────────────────────────────────────────────
    // When hasNumberField is true, the partner must also enter a text value
    // (e.g., the Aadhaar number or PAN number) alongside the image upload.
    hasNumberField: {
      type: Boolean,
      default: false,
    },

    numberFieldLabel: {
      type: String,
      trim: true,
      default: "",
      // Example: "Aadhaar Number", "PAN Number", "DL Number"
    },

    numberFieldPlaceholder: {
      type: String,
      trim: true,
      default: "",
    },

    // Stored as a string, compiled to RegExp at runtime via new RegExp(value)
    // Example: "^\\d{12}$" for Aadhaar, "^[A-Z]{5}[0-9]{4}[A-Z]{1}$" for PAN
    // Empty string = no validation applied
    numberFieldValidationRegex: {
      type: String,
      default: "",
    },

    numberFieldValidationMessage: {
      type: String,
      default: "",
      // Example: "Aadhaar number must be exactly 12 digits."
    },

    // ── Upload config ────────────────────────────────────────────────────────
    acceptedFileTypes: {
      type: [String],
      default: ["image/jpeg", "image/png", "image/webp"],
      // For documents that accept PDF: ["image/jpeg", "image/png", "application/pdf"]
    },

    maxFileSizeMB: {
      type: Number,
      default: 5,
      min: [0.1, "Max file size must be at least 0.1 MB."],
      max: [50, "Max file size cannot exceed 50 MB."],
    },

    // ── Multi-page flag ──────────────────────────────────────────────────────
    // When true, this document type expects TWO uploads (e.g., Aadhaar front/back).
    // The frontend renders two upload slots. Both uploads create separate
    // PartnerDocument records with the same documentTypeId but different sides.
    // side field in PartnerDocument distinguishes "front" from "back".
    isMultiPage: {
      type: Boolean,
      default: false,
    },

    // ── Requirement config ───────────────────────────────────────────────────
    isRequired: {
      type: Boolean,
      default: true,
      // If false, document is optional (shown but not blocking for verification)
    },

    // Empty array = required for ALL service categories.
    // Populated array = required only for partners in those categories.
    // This lets you add GST Certificate only for commercial service partners
    // without touching any other document or code.
    requiredForCategories: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
      default: [],
    },

    // ── Display config ───────────────────────────────────────────────────────
    icon: {
      type: String,
      default: "",
      // Icon name from your design system, or a URL
    },

    displayOrder: {
      type: Number,
      default: 0,
      // Lower numbers render first. Use gaps (10, 20, 30) to allow insertion
      // without re-ordering the entire list.
      index: true,
    },

    // ── Sample image ─────────────────────────────────────────────────────────
    // Admin uploads a sample document image to show partners what is expected.
    // Stored as a Cloudinary asset.
    sampleImage: {
      url:      { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // ── Soft disable ─────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      index: true,
      // false = hidden from all partner-facing endpoints.
      // Existing PartnerDocument records are preserved.
    },

    // ── Admin audit trail ────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// key is unique by schema definition above (unique: true creates the index).
// Compound index for the partner-facing fetch: active documents in order.
documentTypeSchema.index({ isActive: 1, displayOrder: 1 });

export default mongoose.model("DocumentType", documentTypeSchema);
