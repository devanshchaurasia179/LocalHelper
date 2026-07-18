/**
 * verification.ts
 *
 * TypeScript types that mirror the backend's buildDocumentObject() response shape.
 * These are the ONLY types the Partner App needs for the entire verification flow.
 *
 * Frontend rule: Never add document-specific logic based on `key`.
 * Read the flags (hasNumberField, isMultiPage, isRequired) and render accordingly.
 */

// ─── Document-level status ─────────────────────────────────────────────────

export type DocumentUploadStatus =
  | "missing"       // no file uploaded yet
  | "pending"       // uploaded, awaiting queue
  | "under_review"  // admin is reviewing
  | "approved"      // approved — view-only
  | "rejected";     // rejected — re-upload available

// ─── Badge ────────────────────────────────────────────────────────────────

export type BadgeColor = "gray" | "yellow" | "green" | "red";

export type DocumentBadge = {
  label: string;
  color: BadgeColor;
};

// ─── Action ───────────────────────────────────────────────────────────────

export type DocumentActionType = "upload" | "replace" | "view" | "none";

export type DocumentAction = {
  type: DocumentActionType;
  label: string | null;
};

// ─── Single document object (one card in the list) ─────────────────────────

export type VerificationDocument = {
  // ── Identity ─────────────────────────────────────────────────────────
  documentTypeId: string;
  /** Stable key: "aadhaar_front", "aadhaar_back", "pan_card", "selfie", etc. */
  key: string;
  /** "single" | "front" | "back" — sent back to POST /verification/documents */
  side: "single" | "front" | "back";

  // ── Display ───────────────────────────────────────────────────────────
  title: string;
  subtitle: string | null;
  helpText: string | null;
  uploadInstructions: string | null;
  /** Icon identifier — mapped to Ionicons in DocumentIcon component */
  icon: string | null;
  sampleImageUrl: string | null;

  // ── Requirement ───────────────────────────────────────────────────────
  isRequired: boolean;
  requiredLabel: "Required" | "Optional";

  // ── Upload constraints ─────────────────────────────────────────────────
  isMultiPage: boolean;
  acceptedTypes: string[];            // ["image/jpeg", "image/png", ...]
  maxSizeMB: number;
  /** Human-readable: "JPG, PNG" or "JPG, PNG, PDF" */
  acceptedTypesLabel: string;

  // ── Number field (text input rendered alongside image upload) ──────────
  hasNumberField: boolean;
  numberFieldLabel: string | null;
  numberFieldPlaceholder: string | null;
  numberFieldValidationMessage: string | null;

  // ── Status (computed by backend — frontend reads, never calculates) ────
  uploadStatus: DocumentUploadStatus;
  badge: DocumentBadge;
  action: DocumentAction;

  // ── Upload data ───────────────────────────────────────────────────────
  previewUrl: string | null;
  numberValue: string | null;    // pre-fill number input on re-upload
  uploadedAt: string | null;
  version: number | null;
  versionLabel: string | null;   // "v2", "v3", or null

  // ── Rejection details ─────────────────────────────────────────────────
  rejectionReason: string | null;
  rejectedAt: string | null;
};

// ─── Banner ───────────────────────────────────────────────────────────────

export type BannerType = "info" | "warning" | "success" | "error";

export type VerificationBanner = {
  type: BannerType;
  title: string;
  message: string;
};

// ─── Progress ─────────────────────────────────────────────────────────────

export type VerificationProgress = {
  uploaded: number;
  total: number;
  percentage: number;
};

// ─── Summary ──────────────────────────────────────────────────────────────

export type VerificationSummary = {
  total: number;
  uploaded: number;
  approved: number;
  rejected: number;
  underReview: number;
  missing: number;
};

// ─── Top-level GET /partner/verification response ──────────────────────────

export type VerificationResponse = {
  verificationStatus: string;
  sessionStatus: string;
  sessionNumber: number | null;
  submittedAt: string | null;

  banner: VerificationBanner;
  progress: VerificationProgress;
  canUploadMore: boolean;
  summary: VerificationSummary;

  documents: VerificationDocument[];
};

// ─── POST /partner/verification/documents request ──────────────────────────

export type UploadDocumentPayload = {
  /** Local file URI from expo-image-picker, e.g. "file:///..." */
  fileUri: string;
  /** MIME type: "image/jpeg", "image/png", "application/pdf" */
  mimeType: string;
  /** ObjectId string from VerificationDocument.documentTypeId */
  documentTypeId: string;
  /** "single" | "front" | "back" */
  side: "single" | "front" | "back";
  /** Only required when VerificationDocument.hasNumberField === true */
  numberValue?: string;
};

// ─── POST /partner/verification/documents response ─────────────────────────

export type UploadDocumentResponse = {
  message: string;
  sessionStatus: string;
  document: VerificationDocument;
};
