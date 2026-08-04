import Partner from "../models/partner/Partner.js";
import DocumentType from "../models/verification/DocumentType.js";
import PartnerDocument from "../models/verification/PartnerDocument.js";
import VerificationSession from "../models/verification/VerificationSession.js";
import { uploadToCloudinary } from "../middleware/upload.middleware.js";
import cloudinary from "../config/cloudinary.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * getRelevantDocumentTypes(partnerCategories)
 *
 * Returns all active DocumentTypes that apply to this partner.
 *
 * Two-stage filter:
 *
 * Stage 1 — Visibility (visibleToCategories):
 *   - Empty array = shown to ALL partners (global document)
 *   - Populated   = shown ONLY if partner has at least one matching category
 *   Example: Driving License with visibleToCategories: [driverCatId]
 *            → only appears for partners in the driver category
 *
 * Stage 2 — Requirement (requiredForCategories):
 *   Applied AFTER visibility. Controls whether the document is required
 *   or optional for the filtered set of partners.
 *   - Empty array = required for ALL partners who can see it
 *   - Populated   = required only for partners in those categories
 *                   (others see it but as optional)
 *   Example: GST Certificate visible to all, but requiredForCategories: [commercial]
 *            → commercial partners must upload it; others see it as optional
 *
 * @param {ObjectId[]} partnerCategories - partner.categories array
 * @returns {DocumentType[]}
 */
const getRelevantDocumentTypes = async (partnerCategories) => {
  const allActive = await DocumentType.find({ isActive: true })
    .sort({ displayOrder: 1 })
    .lean();

  // Convert partner categories to string for comparison (ObjectId vs string safe)
  const partnerCatStrings = (partnerCategories || []).map((c) => c.toString());

  return allActive.filter((docType) => {
    // ── Stage 1: Visibility check ─────────────────────────────────────────
    // If visibleToCategories is populated, partner must belong to at least one
    // of those categories to see this document at all.
    if (docType.visibleToCategories && docType.visibleToCategories.length > 0) {
      const isVisible = docType.visibleToCategories.some((catId) =>
        partnerCatStrings.includes(catId.toString())
      );
      if (!isVisible) return false; // completely hidden from this partner
    }

    // ── Stage 2: Document passes visibility — include it ──────────────────
    // The isRequired flag + requiredForCategories will be evaluated separately
    // in syncSessionStatus / progress calculation. Here we just decide visibility.
    return true;
  });
};

/**
 * getActiveUploads(partnerId)
 *
 * Returns all non-Superseded PartnerDocument records for a partner
 * as a Map keyed by `${documentTypeId}_${side}` for O(1) lookups.
 *
 * @param {ObjectId} partnerId
 * @returns {Map<string, PartnerDocument>}
 */
const getActiveUploads = async (partnerId) => {
  const uploads = await PartnerDocument.find({
    partnerId,
    status: { $ne: "Superseded" },
  }).lean();

  const map = new Map();
  for (const upload of uploads) {
    const key = `${upload.documentTypeId.toString()}_${upload.side}`;
    map.set(key, upload);
  }
  return map;
};

/**
 * getOrCreateSession(partnerId)
 *
 * Finds the most recent active (non-Approved) VerificationSession
 * or creates a fresh one.
 *
 * "Active" = the latest session that the partner is currently working on.
 * An Approved session is terminal — any new upload starts a new session
 * only if it's for a rejected/optional document. We handle that in uploadDocument.
 *
 * @param {ObjectId} partnerId
 * @returns {VerificationSession}
 */
const getOrCreateSession = async (partnerId) => {
  // Find the most recent session that is not in a terminal Approved state
  const existing = await VerificationSession.findOne({
    partnerId,
    overallStatus: { $nin: ["Approved"] },
  }).sort({ createdAt: -1 });

  if (existing) return existing;

  // Count previous sessions to set sessionNumber
  const count = await VerificationSession.countDocuments({ partnerId });

  return await VerificationSession.create({
    partnerId,
    overallStatus: "Pending",
    sessionNumber: count + 1,
    history: [
      {
        status: "Pending",
        changedBy: "partner",
        changedByRole: "partner",
        changedByName: "Partner",
        changedAt: new Date(),
        note: "Verification session started.",
      },
    ],
  });
};

/**
 * syncSessionStatus(session, relevantDocTypes, uploadMap)
 *
 * Recalculates the session's overallStatus based on current upload state.
 * Called after every upload to keep the session in sync.
 *
 * Rules:
 *   - All required doc slots have an active upload (any status) → "Under Review"
 *   - Some required doc slots are still missing                  → "In Progress"
 *   - No uploads at all                                          → "Pending"
 *
 * Does NOT touch Approved sessions — an optional re-upload shouldn't reset approval.
 *
 * @param {VerificationSession} session
 * @param {DocumentType[]} relevantDocTypes
 * @param {Map} uploadMap
 * @returns {string} new status
 */
const syncSessionStatus = (session, relevantDocTypes, uploadMap) => {
  // Never downgrade an Approved or Rejected session here
  // (Rejected recovery is handled separately in uploadDocument)
  if (session.overallStatus === "Approved") return "Approved";

  // Never auto-advance to "Under Review" — partner must explicitly submit.
  // We only track whether they're "In Progress" (some uploaded) or "Pending" (none).
  if (session.overallStatus === "Under Review") return "Under Review";

  const requiredTypes = relevantDocTypes.filter((dt) => dt.isRequired);

  // Check if any required doc slot has been uploaded
  let anyCovered = false;

  for (const docType of requiredTypes) {
    if (docType.isMultiPage) {
      const frontKey = `${docType._id.toString()}_front`;
      const backKey  = `${docType._id.toString()}_back`;
      if (uploadMap.has(frontKey) || uploadMap.has(backKey)) {
        anyCovered = true;
        break;
      }
    } else {
      const singleKey = `${docType._id.toString()}_single`;
      if (uploadMap.has(singleKey)) {
        anyCovered = true;
        break;
      }
    }
  }

  // Also count optional docs
  if (!anyCovered) {
    anyCovered = uploadMap.size > 0;
  }

  return anyCovered ? "In Progress" : "Pending";
};

/**
 * syncPartnerVerificationStatus(partnerId, sessionStatus)
 *
 * Updates the denormalized Partner.verificationStatus to match the session.
 * Maps session statuses to Partner model enum values.
 *
 * Partner model enum: "Pending" | "Under Review" | "Approved" | "Rejected"
 */
const SESSION_TO_PARTNER_STATUS = {
  Pending:       "Pending",
  "In Progress": "Pending",       // still uploading, not yet submitted
  "Under Review": "Under Review",
  Approved:      "Approved",
  Rejected:      "Rejected",
  "Re-submitted": "Under Review",
};

const syncPartnerVerificationStatus = async (partnerId, sessionStatus) => {
  const partnerStatus = SESSION_TO_PARTNER_STATUS[sessionStatus] || "Pending";
  await Partner.findByIdAndUpdate(partnerId, {
    $set: {
      verificationStatus: partnerStatus,
      // Mark document step as complete once partner reaches "Under Review"
      ...(partnerStatus === "Under Review" ? { isDocument: true } : {}),
    },
  });
};

// ─── GET VERIFICATION STATUS ──────────────────────────────────────────────────
/**
 * GET /api/partner/verification
 * 🔒 Requires partner_token cookie
 *
 * The single source of truth for the partner's document verification screen.
 * Returns everything the frontend needs to render the screen end-to-end.
 *
 * The frontend contract:
 *   - Render the banner using response.banner
 *   - Render progress bar using response.progress
 *   - Map over response.documents to render document cards
 *   - Use document.action.type to decide which CTA button to show
 *   - Use document.badge to render the status chip
 *   - Use response.canUploadMore to lock the screen when Approved
 *
 * Zero business logic required on the frontend.
 */
export const getVerificationStatus = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId)
      .select("categories verification verificationStatus fullName")
      .lean();

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    // ── 1. Load relevant document types for this partner ───────────────────
    const relevantDocTypes = await getRelevantDocumentTypes(partner.categories);

    // ── 2. Load all active uploads for this partner ────────────────────────
    const uploadMap = await getActiveUploads(req.partnerId);

    // ── 3. Load the current verification session ───────────────────────────
    const session = await VerificationSession.findOne({
      partnerId: req.partnerId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const overallStatus = partner.verificationStatus || "Pending";
    const sessionStatus = session?.overallStatus     || "Pending";

    // ── 4. Build the document list ─────────────────────────────────────────
    const documents = [];
    const partnerCatStrings = (partner.categories || []).map((c) => c.toString());

    for (const docType of relevantDocTypes) {
      if (docType.isMultiPage) {
        for (const side of ["front", "back"]) {
          const uploadKey = `${docType._id.toString()}_${side}`;
          const upload    = uploadMap.get(uploadKey) || null;
          documents.push(buildDocumentObject(docType, upload, side, partnerCatStrings));
        }
      } else {
        const uploadKey = `${docType._id.toString()}_single`;
        const upload    = uploadMap.get(uploadKey) || null;
        documents.push(buildDocumentObject(docType, upload, "single", partnerCatStrings));
      }
    }

    // ── 5. Compute summary counts ──────────────────────────────────────────
    const summary = {
      total:       documents.length,
      uploaded:    documents.filter((d) => d.uploadStatus !== "missing").length,
      approved:    documents.filter((d) => d.uploadStatus === "approved").length,
      rejected:    documents.filter((d) => d.uploadStatus === "rejected").length,
      underReview: documents.filter((d) => d.uploadStatus === "under_review").length,
      missing:     documents.filter((d) => d.uploadStatus === "missing").length,
    };

    // ── 6. Build progress indicator ────────────────────────────────────────
    // "Progress" = how many required document slots have any active upload.
    // Optional documents are excluded — they don't block completion.
    const requiredDocs  = documents.filter((d) => d.isRequired);
    const coveredRequired = requiredDocs.filter((d) => d.uploadStatus !== "missing").length;
    const progress = {
      uploaded:   coveredRequired,
      total:      requiredDocs.length,
      percentage: requiredDocs.length > 0
        ? Math.round((coveredRequired / requiredDocs.length) * 100)
        : 100,
    };

    // ── 7. Build the top-level banner ──────────────────────────────────────
    const banner = buildBanner(overallStatus, sessionStatus, summary);

    // ── 8. canUploadMore — false when fully approved ───────────────────────
    // Approved partners should not be able to overwrite approved documents
    // unless a specific document gets rejected (individual doc action handles that).
    const canUploadMore = overallStatus !== "Approved";

    return res.status(200).json({
      // ── Verification state ───────────────────────────────────────────────
      verificationStatus: overallStatus,
      sessionStatus,
      sessionNumber:      session?.sessionNumber  || null,
      submittedAt:        session?.submittedAt    || null,

      // ── UI directives ────────────────────────────────────────────────────
      banner,
      progress,
      canUploadMore,

      // ── Counts ───────────────────────────────────────────────────────────
      summary,

      // ── Document cards ───────────────────────────────────────────────────
      // Frontend: documents.map(doc => <DocumentCard doc={doc} />)
      documents,
    });
  } catch (error) {
    console.error("getVerificationStatus error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

/**
 * buildBanner(overallStatus, sessionStatus, summary)
 *
 * Produces the top-level status banner object.
 * The frontend renders this directly — no switch statements needed client-side.
 *
 * type: "info" | "warning" | "success" | "error"
 *   Maps to your design system's alert/banner color variants.
 */
const buildBanner = (overallStatus, sessionStatus, summary) => {
  // Rejected takes highest priority — partner must act
  if (overallStatus === "Rejected" || summary.rejected > 0) {
    return {
      type:    "error",
      title:   "Action Required",
      message:
        summary.rejected > 0
          ? `${summary.rejected} document${summary.rejected > 1 ? "s were" : " was"} rejected. Please re-upload and resubmit.`
          : "Your verification was rejected. Please review and resubmit your documents.",
    };
  }

  if (overallStatus === "Approved") {
    return {
      type:    "success",
      title:   "Account Verified",
      message: "Your identity has been verified. You can now accept jobs.",
    };
  }

  if (overallStatus === "Under Review" || sessionStatus === "Under Review") {
    return {
      type:    "warning",
      title:   "Under Review",
      message: "Your documents are being reviewed. This usually takes 24–48 hours.",
    };
  }

  if (sessionStatus === "In Progress") {
    return {
      type:    "info",
      title:   "Almost There",
      message: `Upload all required documents to submit for verification. ${summary.missing} remaining.`,
    };
  }

  // Default — Pending, nothing uploaded yet
  return {
    type:    "info",
    title:   "Complete Your Verification",
    message: "Upload the required documents below to get your account verified.",
  };
};

/**
 * buildDocumentObject(docType, upload, side, partnerCatStrings)
 *
 * The definitive UI contract for a single document card.
 * Every field the frontend needs to render a document card is present here.
 *
 * Frontend usage:
 *   documents.map(doc => <DocumentCard doc={doc} />)
 *
 * Key derived fields:
 *
 *   uploadStatus — string enum for selecting the card variant:
 *     "missing"      → empty state, show upload prompt
 *     "under_review" → uploaded, show waiting state
 *     "approved"     → show green approved state
 *     "rejected"     → show red rejected state with rejectionReason
 *
 *   badge — pre-computed status chip:
 *     { label: "Approved", color: "green" }
 *     The frontend renders: <Badge label={doc.badge.label} color={doc.badge.color} />
 *
 *   action — what the primary CTA button should do:
 *     { type: "upload",  label: "Upload"  }  — no file yet
 *     { type: "replace", label: "Replace" }  — has file (any status except approved)
 *     { type: "view",    label: "View"    }  — approved, view-only
 *     { type: "none",    label: null      }  — under review, no action available
 *
 *   requiredLabel — chip text: "Required" or "Optional"
 *
 *   version — null if first upload, "v2" / "v3" for re-uploads
 *
 * @param {object}   docType           - DocumentType lean object
 * @param {object}   upload            - PartnerDocument lean object or null
 * @param {string}   side              - "single" | "front" | "back"
 * @param {string[]} partnerCatStrings - partner category IDs as strings
 */
const buildDocumentObject = (docType, upload, side, partnerCatStrings = []) => {
  // ── Resolve effective isRequired ────────────────────────────────────────
  // docType.isRequired is the base flag.
  // If requiredForCategories is populated, override isRequired based on
  // whether the partner belongs to one of those categories.
  let effectiveIsRequired = docType.isRequired;
  if (docType.requiredForCategories && docType.requiredForCategories.length > 0) {
    effectiveIsRequired = docType.requiredForCategories.some((catId) =>
      partnerCatStrings.includes(catId.toString())
    );
  }
  // ── Compute uploadStatus ────────────────────────────────────────────────
  let uploadStatus = "missing";
  if (upload) {
    const statusMap = {
      "Under Review": "under_review",
      Approved:       "approved",
      Rejected:       "rejected",
      Pending:        "pending",
    };
    uploadStatus = statusMap[upload.status] || "missing";
  }

  // ── Compute badge ───────────────────────────────────────────────────────
  const badgeMap = {
    missing:      { label: "Not Uploaded", color: "gray"   },
    pending:      { label: "Pending",      color: "gray"   },
    under_review: { label: "Under Review", color: "yellow" },
    approved:     { label: "Approved",     color: "green"  },
    rejected:     { label: "Rejected",     color: "red"    },
  };
  const badge = badgeMap[uploadStatus] || badgeMap.missing;

  // ── Compute action ──────────────────────────────────────────────────────
  // "missing"      → upload CTA ("upload")
  // "pending"      → draft, partner can add more photos ("add_more")
  // "under_review" → locked, awaiting admin action ("none")
  // "approved"     → view-only ("view")
  // "rejected"     → fresh re-upload ("replace")
  let action;
  if (uploadStatus === "missing") {
    action = { type: "upload",   label: "Upload Document"  };
  } else if (uploadStatus === "pending") {
    action = { type: "add_more", label: "Add More Photos"  };
  } else if (uploadStatus === "approved") {
    action = { type: "view",     label: "View Document"    };
  } else if (uploadStatus === "under_review") {
    action = { type: "none",     label: null               };
  } else {
    // rejected
    action = { type: "replace",  label: "Replace Document" };
  }

  // ── Side label suffix ───────────────────────────────────────────────────
  const sideLabel =
    side === "front" ? " (Front)" :
    side === "back"  ? " (Back)"  : "";

  // ── Version label ───────────────────────────────────────────────────────
  // null for first upload, "v2" onwards for re-uploads
  const versionLabel = upload && upload.version > 1
    ? `v${upload.version}`
    : null;

  return {
    // ── Identity ─────────────────────────────────────────────────────────
    documentTypeId: docType._id,
    // Stable key the frontend can use as React list key and for upload calls
    key:  side === "single" ? docType.key : `${docType.key}_${side}`,
    side, // "single" | "front" | "back" — sent back in POST /documents

    // ── Display ───────────────────────────────────────────────────────────
    title:              docType.label + sideLabel,
    subtitle:           docType.description       || null,
    helpText:           docType.helpText          || null,
    uploadInstructions: docType.uploadInstructions || null,
    icon:               docType.icon              || null,
    sampleImageUrl:     docType.sampleImage?.url  || null,

    // ── Requirement chip ──────────────────────────────────────────────────
    isRequired:    effectiveIsRequired,
    requiredLabel: effectiveIsRequired ? "Required" : "Optional",

    // ── Upload constraints (shown in upload sheet / info drawer) ──────────
    isMultiPage:   docType.isMultiPage,
    acceptedTypes: docType.acceptedFileTypes,   // ["image/jpeg", "image/png", ...]
    maxSizeMB:     docType.maxFileSizeMB,
    // Human-readable accepted types for display: "JPG, PNG, PDF"
    acceptedTypesLabel: docType.acceptedFileTypes
      .map((t) => t.split("/")[1].toUpperCase().replace("JPEG", "JPG"))
      .join(", "),

    // ── Number field (renders a text input alongside the upload button) ───
    hasNumberField:               docType.hasNumberField,
    numberFieldLabel:             docType.numberFieldLabel             || null,
    numberFieldPlaceholder:       docType.numberFieldPlaceholder       || null,
    numberFieldValidationMessage: docType.numberFieldValidationMessage || null,

    // ── Status (computed by backend — frontend reads, never calculates) ───
    uploadStatus,  // "missing" | "pending" | "under_review" | "approved" | "rejected"
    badge,         // { label, color } — render the status chip directly
    action,        // { type, label }  — render the CTA button directly

    // ── Upload data ───────────────────────────────────────────────────────
    previewUrl:  upload?.cloudinaryFiles?.[0]?.url || null, // primary / first photo
    previewUrls: upload?.cloudinaryFiles?.map((f) => f.url) || [], // all photos
    numberValue: upload?.numberValue     || null,  // pre-fill the number input on re-upload
    uploadedAt:  upload?.uploadedAt      || null,
    version:     upload?.version         || null,  // raw number
    versionLabel,                                  // "v2", "v3", or null

    // ── Rejection details ─────────────────────────────────────────────────
    // Shown inside the card when uploadStatus === "rejected"
    rejectionReason: upload?.rejectionReason || null,
    rejectedAt:      upload?.rejectedAt      || null,
  };
};

// ─── UPLOAD DOCUMENT ──────────────────────────────────────────────────────────
/**
 * POST /api/partner/documents
 * 🔒 Requires partner_token cookie
 * Content-Type: multipart/form-data
 *
 * Fields:
 *   file            (binary)  — the image file
 *   documentTypeId  (string)  — which DocumentType to upload for
 *   side            (string)  — "single" | "front" | "back"
 *   numberValue     (string)  — required when DocumentType.hasNumberField is true
 *
 * One file per request. For multi-page documents (Aadhaar), call twice:
 *   once with side=front, once with side=back.
 *
 * Every upload goes through the same pipeline regardless of document type.
 * No hardcoded document names anywhere.
 */
export const uploadDocument = async (req, res) => {
  try {
    // ── 1. Validate file presence ──────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({
        message: "No file provided. Send the file under the field name 'file'.",
      });
    }

    const { documentTypeId, side = "single", numberValue } = req.body;

    // ── 2. Validate required body fields ──────────────────────────────────
    if (!documentTypeId) {
      return res.status(400).json({ message: "documentTypeId is required." });
    }

    if (!["single", "front", "back"].includes(side)) {
      return res.status(400).json({
        message: "side must be 'single', 'front', or 'back'.",
      });
    }

    // ── 3. Load and validate DocumentType ─────────────────────────────────
    const docType = await DocumentType.findById(documentTypeId);

    if (!docType) {
      return res.status(404).json({ message: "Document type not found." });
    }

    if (!docType.isActive) {
      return res.status(400).json({
        message: `"${docType.label}" is no longer accepted. Contact support.`,
      });
    }

    // ── 4. Validate side against isMultiPage ──────────────────────────────
    if (docType.isMultiPage && side === "single") {
      return res.status(400).json({
        message: `"${docType.label}" requires a side of 'front' or 'back', not 'single'.`,
      });
    }

    if (!docType.isMultiPage && side !== "single") {
      return res.status(400).json({
        message: `"${docType.label}" is a single-page document. Use side='single'.`,
      });
    }

    // ── 5. Validate numberValue if required ───────────────────────────────
    if (docType.hasNumberField) {
      if (!numberValue || !numberValue.trim()) {
        return res.status(400).json({
          message: `${docType.numberFieldLabel || "Document number"} is required.`,
        });
      }

      // Validate against the stored regex pattern
      if (docType.numberFieldValidationRegex) {
        try {
          const pattern = new RegExp(docType.numberFieldValidationRegex);
          const valueToTest = numberValue.trim().toUpperCase();

          if (!pattern.test(valueToTest)) {
            return res.status(400).json({
              message:
                docType.numberFieldValidationMessage ||
                `Invalid ${docType.numberFieldLabel} format.`,
            });
          }
        } catch {
          // Regex in DB is invalid — this is an admin config error, not a partner error
          // Log it but don't block the upload. Admin should fix via update endpoint.
          console.error(
            `Invalid regex for DocumentType ${docType.key}: ${docType.numberFieldValidationRegex}`
          );
        }
      }
    }

    // ── 6. Validate file MIME type ─────────────────────────────────────────
    // iOS devices capture in HEIC/HEIF by default. Normalise both to the
    // "image/*" family so they pass the acceptedFileTypes check alongside
    // JPEG/PNG. Cloudinary handles HEIC natively via resource_type: "auto".
    const HEIC_ALIASES = ["image/heic", "image/heif"];
    const effectiveMime = HEIC_ALIASES.includes(req.file.mimetype)
      ? "image/jpeg" // treat as JPEG for the acceptedFileTypes comparison
      : req.file.mimetype;

    const acceptedTypes = docType.acceptedFileTypes;
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(effectiveMime) && !acceptedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: `Invalid file type. "${docType.label}" accepts: ${acceptedTypes.join(", ")}.`,
      });
    }

    // ── 7. Validate file size ──────────────────────────────────────────────
    const maxBytes = docType.maxFileSizeMB * 1024 * 1024;
    if (req.file.size > maxBytes) {
      return res.status(400).json({
        message: `File too large. Maximum size for "${docType.label}" is ${docType.maxFileSizeMB} MB.`,
      });
    }

    // ── 8. Load partner to get categories for session logic ────────────────
    const partner = await Partner.findById(req.partnerId)
      .select("categories verification")
      .lean();

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    // ── 9. Find the current active upload for this slot ───────────────────
    // "Slot" = the unique combination of (partnerId, documentTypeId, side)
    const activeUpload = await PartnerDocument.findOne({
      partnerId:      req.partnerId,
      documentTypeId: docType._id,
      side,
      status:         { $ne: "Superseded" },
    });

    // ── Decide: append photo vs. replace document ──────────────────────────
    //
    // APPEND  — active record exists AND is "Pending"
    //           Partner has not yet submitted. Adding another photo to the
    //           same draft slot. Push to cloudinaryFiles, keep same record.
    //
    // REPLACE — active record exists AND is "Approved" or "Rejected"
    //           Partner is starting a fresh submission for this slot.
    //           Supersede the old record and create a new one.
    //
    // FIRST   — no active record at all → create fresh (version 1, Pending).
    //
    // NOTE: "Under Review" records are NOT editable — the submit endpoint
    // locks all Pending records to Under Review. Once locked the partner
    // can only wait for admin action.
    //
    const shouldAppend =
      activeUpload && activeUpload.status === "Pending";

    const shouldReplace =
      activeUpload &&
      (activeUpload.status === "Approved" || activeUpload.status === "Rejected");

    // version only increments on a true re-upload (replace), not on append
    const nextVersion = shouldReplace ? activeUpload.version + 1 : 1;

    // ── 10. Upload to Cloudinary ───────────────────────────────────────────
    const folder   = `partners/${req.partnerId}/documents`;
    const publicId = side === "single"
      ? `${docType.key}_${Date.now()}`
      : `${docType.key}_${side}_${Date.now()}`;

    const cloudinaryResult = await uploadToCloudinary(
      req.file.buffer,
      folder,
      publicId
    );

    // ── 11. Supersede only when replacing (not when appending) ─────────────
    if (shouldReplace) {
      await PartnerDocument.findByIdAndUpdate(activeUpload._id, {
        $set: { status: "Superseded" },
      });
    }

    const newCloudinaryEntry = {
      url:      cloudinaryResult.url,
      publicId: cloudinaryResult.publicId,
      format:   cloudinaryResult.format,
      width:    cloudinaryResult.width,
      height:   cloudinaryResult.height,
      bytes:    req.file.size,
    };

    let newDocument;

    if (shouldAppend) {
      // ── 12a. Append photo to the existing Pending draft record ─────────
      activeUpload.cloudinaryFiles.push(newCloudinaryEntry);
      activeUpload.uploadedAt = new Date();
      // Update numberValue if partner corrected it while still in draft
      if (docType.hasNumberField && numberValue?.trim()) {
        activeUpload.numberValue = numberValue.trim().toUpperCase();
      }
      await activeUpload.save();
      newDocument = activeUpload;
    } else {
      // ── 12b. Create a fresh PartnerDocument draft record ───────────────
      // Status is "Pending" — it only moves to "Under Review" when the
      // partner explicitly presses "Submit for Review".
      newDocument = await PartnerDocument.create({
        partnerId:      req.partnerId,
        documentTypeId: docType._id,
        side,
        status:         "Pending",
        cloudinaryFiles: [newCloudinaryEntry],
        numberValue: docType.hasNumberField
          ? (numberValue.trim().toUpperCase())
          : null,
        version:    shouldReplace ? nextVersion : 1,
        uploadedAt: new Date(),
      });
    }

    // ── 14. Get/create VerificationSession and sync status ─────────────────
    const session = await getOrCreateSession(req.partnerId);

    // If this is a re-upload after rejection, record that in history
    if (session.overallStatus === "Rejected" || session.overallStatus === "Re-submitted") {
      session.history.push({
        status:        "Re-submitted",
        changedBy:     "partner",
        changedByRole: "partner",
        changedByName: "Partner",
        changedAt:     new Date(),
        note:          `Re-uploaded: ${docType.label}${side !== "single" ? ` (${side})` : ""}`,
      });
    }

    // Rebuild the upload map to include the new document for status calculation
    const uploadMap = await getActiveUploads(req.partnerId);
    const relevantDocTypes = await getRelevantDocumentTypes(partner.categories);
    const newSessionStatus = syncSessionStatus(session, relevantDocTypes, uploadMap);

    // Push a history entry if the status changed
    if (newSessionStatus !== session.overallStatus) {
      session.history.push({
        status:        newSessionStatus,
        changedBy:     "partner",
        changedByRole: "partner",
        changedByName: "Partner",
        changedAt:     new Date(),
        note:          newSessionStatus === "Under Review"
          ? "All required documents uploaded. Submitted for review."
          : `Uploaded: ${docType.label}${side !== "single" ? ` (${side})` : ""}`,
      });
    }

    // Snapshot required document IDs at submission time
    if (newSessionStatus === "Under Review" && session.overallStatus !== "Under Review") {
      session.submittedAt = new Date();
      session.requiredDocumentsSnapshot = relevantDocTypes
        .filter((dt) => dt.isRequired)
        .map((dt) => dt._id);
    }

    session.overallStatus = newSessionStatus;
    await session.save();

    // ── 15. Sync Partner.verificationStatus (denormalized cache) ──────────
    await syncPartnerVerificationStatus(req.partnerId, newSessionStatus);

    // ── 16. Build and return the document object ───────────────────────────
    const responseDoc = buildDocumentObject(
      docType.toObject(),
      newDocument.toObject(),
      side
    );

    return res.status(201).json({
      message:            `${docType.label}${side !== "single" ? ` (${side})` : ""} uploaded successfully.`,
      sessionStatus:      newSessionStatus,
      document:           responseDoc,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid documentTypeId." });
    }
    console.error("uploadDocument error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── SUBMIT FOR REVIEW ────────────────────────────────────────────────────────
/**
 * POST /api/partner/verification/submit
 * 🔒 Requires partner_token cookie
 *
 * Explicitly submits the partner's uploaded documents for admin review.
 * Transitions the session from "In Progress" → "Under Review".
 *
 * Validation:
 *   - All required document slots must have at least one active upload.
 *   - Session must not already be "Under Review" or "Approved".
 *
 * This replaces the old auto-advance logic that triggered "Under Review"
 * as soon as the last required document was uploaded. Now the partner
 * controls when to submit — they can upload multiple photos per slot
 * freely and only submit when they're satisfied.
 */
export const submitVerification = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId)
      .select("categories verificationStatus")
      .lean();

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    // Already approved — nothing to submit
    if (partner.verificationStatus === "Approved") {
      return res.status(400).json({ message: "Your verification is already approved." });
    }

    // Load session
    const session = await VerificationSession.findOne({
      partnerId: req.partnerId,
      overallStatus: { $nin: ["Approved"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(400).json({ message: "No active verification session found. Upload documents first." });
    }

    if (session.overallStatus === "Under Review") {
      return res.status(400).json({ message: "Already submitted and under review." });
    }

    // Load relevant document types for this partner
    const relevantDocTypes = await getRelevantDocumentTypes(partner.categories);

    // Compute effective isRequired per-partner (mirrors buildDocumentObject logic).
    // requiredForCategories overrides the base isRequired flag when populated.
    const partnerCatStrings = (partner.categories || []).map((c) => c.toString());
    const requiredDocTypes = relevantDocTypes.filter((dt) => {
      if (dt.requiredForCategories && dt.requiredForCategories.length > 0) {
        return dt.requiredForCategories.some((catId) =>
          partnerCatStrings.includes(catId.toString())
        );
      }
      return dt.isRequired;
    });

    // Load all active uploads
    const uploadMap = await getActiveUploads(req.partnerId);

    // Validate all required slots are covered
    const missing = [];

    for (const docType of requiredDocTypes) {
      if (docType.isMultiPage) {
        const frontKey = `${docType._id.toString()}_front`;
        const backKey  = `${docType._id.toString()}_back`;
        if (!uploadMap.has(frontKey)) missing.push(`${docType.label} (Front)`);
        if (!uploadMap.has(backKey))  missing.push(`${docType.label} (Back)`);
      } else {
        const singleKey = `${docType._id.toString()}_single`;
        if (!uploadMap.has(singleKey)) missing.push(docType.label);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Please upload all required documents before submitting: ${missing.join(", ")}.`,
        missingDocuments: missing,
      });
    }

    // ── Atomically flip all Pending document records to Under Review ──────
    // This is the moment documents become locked — they were in "Pending"
    // draft state until the partner explicitly pressed Submit.
    await PartnerDocument.updateMany(
      { partnerId: req.partnerId, status: "Pending" },
      { $set: { status: "Under Review" } }
    );

    // Transition to Under Review
    const previousStatus   = session.overallStatus;
    session.overallStatus  = "Under Review";
    session.submittedAt    = new Date();

    // Snapshot required document IDs at submission time
    session.requiredDocumentsSnapshot = requiredDocTypes.map((dt) => dt._id);

    session.history.push({
      status:        "Under Review",
      changedBy:     "partner",
      changedByRole: "partner",
      changedByName: "Partner",
      changedAt:     new Date(),
      note: previousStatus === "Rejected"
        ? "Partner re-submitted all documents for review."
        : "Partner submitted documents for review.",
    });

    await session.save();

    // Sync partner status
    await syncPartnerVerificationStatus(req.partnerId, "Under Review");

    return res.status(200).json({
      message:       "Documents submitted for review. We'll notify you within 24–48 hours.",
      sessionStatus: "Under Review",
    });
  } catch (error) {
    console.error("submitVerification error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── DELETE A SINGLE PHOTO FROM A PENDING DOCUMENT SLOT ──────────────────────
/**
 * DELETE /api/partner/verification/documents/:documentTypeId/:side/photos/:photoIndex
 * 🔒 Requires partner_token cookie
 *
 * Removes one photo (by 0-based index) from a "Pending" document slot.
 * The slot must be in "Pending" status — locked "Under Review" slots cannot
 * be modified.
 *
 * If the removed photo was the last one in the slot, the entire
 * PartnerDocument record is deleted (restoring the slot to "missing").
 *
 * The photo is also deleted from Cloudinary to avoid orphaned assets.
 */
export const deleteDocumentPhoto = async (req, res) => {
  try {
    const { documentTypeId, side, photoIndex } = req.params;
    const idx = parseInt(photoIndex, 10);

    if (!["single", "front", "back"].includes(side)) {
      return res.status(400).json({ message: "Invalid side parameter." });
    }

    if (isNaN(idx) || idx < 0) {
      return res.status(400).json({ message: "photoIndex must be a non-negative integer." });
    }

    // Find the active Pending record for this slot
    const doc = await PartnerDocument.findOne({
      partnerId:      req.partnerId,
      documentTypeId,
      side,
      status:         "Pending",
    });

    if (!doc) {
      return res.status(404).json({
        message: "No editable draft found for this document slot. Only Pending documents can be modified.",
      });
    }

    if (idx >= doc.cloudinaryFiles.length) {
      return res.status(400).json({
        message: `photoIndex ${idx} is out of range. This slot has ${doc.cloudinaryFiles.length} photo(s).`,
      });
    }

    const photoToRemove = doc.cloudinaryFiles[idx];

    // ── Delete from Cloudinary ─────────────────────────────────────────────
    if (photoToRemove?.publicId) {
      try {
        await cloudinary.uploader.destroy(photoToRemove.publicId);
      } catch (cloudErr) {
        // Log but don't fail the request — DB consistency is more important
        console.error("Cloudinary delete failed for", photoToRemove.publicId, cloudErr);
      }
    }

    if (doc.cloudinaryFiles.length === 1) {
      // Last photo removed — delete the entire record (slot goes back to "missing")
      await PartnerDocument.findByIdAndDelete(doc._id);

      return res.status(200).json({
        message:     "Photo removed. Document slot is now empty.",
        slotDeleted: true,
        documentTypeId,
        side,
      });
    }

    // Remove just this photo from the array
    doc.cloudinaryFiles.splice(idx, 1);
    doc.uploadedAt = new Date();
    await doc.save();

    // Rebuild the document object for cache patching on the frontend
    const docType = await DocumentType.findById(documentTypeId).lean();
    const responseDoc = buildDocumentObject(docType, doc.toObject(), side);

    return res.status(200).json({
      message:     "Photo removed successfully.",
      slotDeleted: false,
      document:    responseDoc,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid documentTypeId." });
    }
    console.error("deleteDocumentPhoto error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
