import DocumentType from "../../models/verification/DocumentType.js";
import PartnerDocument from "../../models/verification/PartnerDocument.js";
import { uploadToCloudinary } from "../../middleware/upload.middleware.js";
import cloudinary from "../../config/cloudinary.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * tryCompileRegex(pattern)
 * Returns true if the string is a valid RegExp pattern.
 * Used to validate numberFieldValidationRegex before saving to DB.
 * Storing an invalid regex would silently break runtime validation later.
 */
const tryCompileRegex = (pattern) => {
  if (!pattern) return true; // empty string = no validation = always valid
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

/**
 * buildUpdatePayload(body, adminId)
 * Extracts only the fields that are present in the request body
 * so PATCH updates don't accidentally overwrite fields with undefined.
 */
const PATCHABLE_FIELDS = [
  "label",
  "description",
  "helpText",
  "uploadInstructions",
  "hasNumberField",
  "numberFieldLabel",
  "numberFieldPlaceholder",
  "numberFieldValidationRegex",
  "numberFieldValidationMessage",
  "acceptedFileTypes",
  "maxFileSizeMB",
  "isMultiPage",
  "isRequired",
  "requiredForCategories",
  "icon",
  "displayOrder",
];

const buildUpdatePayload = (body, adminId) => {
  const update = { updatedBy: adminId };

  for (const field of PATCHABLE_FIELDS) {
    // Only include the field if it was explicitly sent in the request body.
    // Checking for undefined means a field sent as `null` or `false` or `0`
    // will still be included — intentional, those are valid values.
    if (body[field] !== undefined) {
      update[field] = body[field];
    }
  }

  return update;
};

// ─── CREATE DOCUMENT TYPE ─────────────────────────────────────────────────────
/**
 * POST /api/admin/document-types
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Body (JSON):
 * {
 *   key: "police_verification",       // required — snake_case slug
 *   label: "Police Verification",     // required — display name
 *   description: "...",
 *   helpText: "...",
 *   uploadInstructions: "...",
 *   hasNumberField: false,
 *   acceptedFileTypes: ["image/jpeg", "image/png"],
 *   maxFileSizeMB: 5,
 *   isMultiPage: false,
 *   isRequired: true,
 *   icon: "shield-check",
 *   displayOrder: 30,
 *   requiredForCategories: []          // empty = required for all
 * }
 */
export const createDocumentType = async (req, res) => {
  try {
    const {
      key,
      label,
      description,
      helpText,
      uploadInstructions,
      hasNumberField,
      numberFieldLabel,
      numberFieldPlaceholder,
      numberFieldValidationRegex,
      numberFieldValidationMessage,
      acceptedFileTypes,
      maxFileSizeMB,
      isMultiPage,
      isRequired,
      requiredForCategories,
      icon,
      displayOrder,
    } = req.body;

    // ── Required field validation ──────────────────────────────────────────
    if (!key || !key.trim()) {
      return res.status(400).json({ message: "key is required." });
    }

    if (!label || !label.trim()) {
      return res.status(400).json({ message: "label is required." });
    }

    // key format: lowercase alphanumeric + underscores only
    if (!/^[a-z0-9_]+$/.test(key.trim())) {
      return res.status(400).json({
        message: "key must be lowercase alphanumeric with underscores only. Example: police_verification",
      });
    }

    // ── Uniqueness check ───────────────────────────────────────────────────
    // Check before insert to return a clear error instead of a mongo duplicate key error.
    const existing = await DocumentType.findOne({ key: key.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({
        message: `A document type with key "${key.trim().toLowerCase()}" already exists.`,
      });
    }

    // ── Regex validation ───────────────────────────────────────────────────
    if (numberFieldValidationRegex && !tryCompileRegex(numberFieldValidationRegex)) {
      return res.status(400).json({
        message: "numberFieldValidationRegex is not a valid regular expression.",
      });
    }

    // ── Size bounds ────────────────────────────────────────────────────────
    if (maxFileSizeMB !== undefined) {
      const size = parseFloat(maxFileSizeMB);
      if (isNaN(size) || size < 0.1 || size > 50) {
        return res.status(400).json({
          message: "maxFileSizeMB must be a number between 0.1 and 50.",
        });
      }
    }

    // ── Create ─────────────────────────────────────────────────────────────
    const docType = await DocumentType.create({
      key:                          key.trim().toLowerCase(),
      label:                        label.trim(),
      description:                  description?.trim() || "",
      helpText:                     helpText?.trim() || "",
      uploadInstructions:           uploadInstructions?.trim() || "",
      hasNumberField:               hasNumberField ?? false,
      numberFieldLabel:             numberFieldLabel?.trim() || "",
      numberFieldPlaceholder:       numberFieldPlaceholder?.trim() || "",
      numberFieldValidationRegex:   numberFieldValidationRegex || "",
      numberFieldValidationMessage: numberFieldValidationMessage?.trim() || "",
      acceptedFileTypes:            acceptedFileTypes || ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMB:                maxFileSizeMB ?? 5,
      isMultiPage:                  isMultiPage ?? false,
      isRequired:                   isRequired ?? true,
      requiredForCategories:        requiredForCategories || [],
      icon:                         icon?.trim() || "",
      displayOrder:                 displayOrder ?? 0,
      createdBy:                    req.admin._id,
      updatedBy:                    req.admin._id,
    });

    return res.status(201).json({
      message: "Document type created successfully.",
      documentType: docType,
    });
  } catch (error) {
    // Mongo duplicate key on `key` field (race condition past our check)
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A document type with this key already exists.",
      });
    }
    console.error("createDocumentType error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── LIST ALL DOCUMENT TYPES ──────────────────────────────────────────────────
/**
 * GET /api/admin/document-types
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Query params:
 *   isActive   true | false  (omit to get all)
 *   search     label substring search
 *
 * Returns all document types (active and inactive) sorted by displayOrder.
 * The admin panel needs to see disabled types to re-enable them.
 * (Partner-facing endpoints only return isActive: true — that's Phase 3)
 */
export const listDocumentTypes = async (req, res) => {
  try {
    const filter = {};

    // Allow filtering by isActive if explicitly provided
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }

    // Label search for admin convenience (not needed at scale, fine for admin panel)
    if (req.query.search) {
      filter.label = { $regex: req.query.search.trim(), $options: "i" };
    }

    const documentTypes = await DocumentType.find(filter)
      .sort({ displayOrder: 1, createdAt: 1 })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    return res.status(200).json({
      total: documentTypes.length,
      documentTypes,
    });
  } catch (error) {
    console.error("listDocumentTypes error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET DOCUMENT TYPE BY ID ──────────────────────────────────────────────────
/**
 * GET /api/admin/document-types/:id
 * 🔒 ADMIN | SUPER_ADMIN
 */
export const getDocumentTypeById = async (req, res) => {
  try {
    const docType = await DocumentType.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("requiredForCategories", "name icon")
      .lean();

    if (!docType) {
      return res.status(404).json({ message: "Document type not found." });
    }

    // Include upload count so the admin knows how many partners have used this type.
    // This informs whether it's safe to delete.
    const uploadCount = await PartnerDocument.countDocuments({
      documentTypeId: docType._id,
      status: { $ne: "Superseded" },
    });

    return res.status(200).json({
      documentType: docType,
      stats: {
        activeUploads: uploadCount,
        canHardDelete: uploadCount === 0,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid document type ID." });
    }
    console.error("getDocumentTypeById error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── UPDATE DOCUMENT TYPE ─────────────────────────────────────────────────────
/**
 * PATCH /api/admin/document-types/:id
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Partial update — only fields present in the body are changed.
 * The `key` field is intentionally NOT patchable after creation.
 * The frontend relies on `key` as a stable identifier.
 * If key needs to change, delete and recreate.
 */
export const updateDocumentType = async (req, res) => {
  try {
    // Guard: key cannot be changed after creation
    if (req.body.key !== undefined) {
      return res.status(400).json({
        message:
          "The key field cannot be changed after creation. " +
          "It is a stable identifier used by the frontend.",
      });
    }

    // Validate regex if provided
    if (
      req.body.numberFieldValidationRegex !== undefined &&
      req.body.numberFieldValidationRegex !== "" &&
      !tryCompileRegex(req.body.numberFieldValidationRegex)
    ) {
      return res.status(400).json({
        message: "numberFieldValidationRegex is not a valid regular expression.",
      });
    }

    // Validate file size range if provided
    if (req.body.maxFileSizeMB !== undefined) {
      const size = parseFloat(req.body.maxFileSizeMB);
      if (isNaN(size) || size < 0.1 || size > 50) {
        return res.status(400).json({
          message: "maxFileSizeMB must be a number between 0.1 and 50.",
        });
      }
    }

    const update = buildUpdatePayload(req.body, req.admin._id);

    // Trim string fields in the update payload
    const stringFields = [
      "label", "description", "helpText", "uploadInstructions",
      "numberFieldLabel", "numberFieldPlaceholder",
      "numberFieldValidationMessage", "icon",
    ];
    for (const field of stringFields) {
      if (typeof update[field] === "string") {
        update[field] = update[field].trim();
      }
    }

    const docType = await DocumentType.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      {
        new: true,         // return the updated document
        runValidators: true, // run mongoose schema validators on update
      }
    )
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!docType) {
      return res.status(404).json({ message: "Document type not found." });
    }

    return res.status(200).json({
      message: "Document type updated successfully.",
      documentType: docType,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid document type ID." });
    }
    console.error("updateDocumentType error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── TOGGLE ACTIVE STATUS ─────────────────────────────────────────────────────
/**
 * PATCH /api/admin/document-types/:id/toggle
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Flips isActive: true → false or false → true.
 * Disabling hides the document type from all partner-facing endpoints.
 * Existing PartnerDocument uploads for this type are NOT affected.
 *
 * Why a dedicated endpoint instead of PATCH?
 * Explicit intent. Makes the audit log readable:
 * "Admin toggled police_verification" vs "Admin patched police_verification".
 */
export const toggleDocumentType = async (req, res) => {
  try {
    const docType = await DocumentType.findById(req.params.id);

    if (!docType) {
      return res.status(404).json({ message: "Document type not found." });
    }

    const newStatus = !docType.isActive;
    docType.isActive  = newStatus;
    docType.updatedBy = req.admin._id;
    await docType.save();

    return res.status(200).json({
      message: `Document type "${docType.label}" has been ${newStatus ? "enabled" : "disabled"}.`,
      documentType: {
        _id:      docType._id,
        key:      docType.key,
        label:    docType.label,
        isActive: docType.isActive,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid document type ID." });
    }
    console.error("toggleDocumentType error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── UPDATE DISPLAY ORDER ─────────────────────────────────────────────────────
/**
 * PATCH /api/admin/document-types/:id/order
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Body: { displayOrder: 20 }
 *
 * Separated from the main PATCH because the admin panel will have a
 * drag-and-drop reorder UI that only sends order changes.
 */
export const updateDisplayOrder = async (req, res) => {
  try {
    const { displayOrder } = req.body;

    if (displayOrder === undefined || displayOrder === null) {
      return res.status(400).json({ message: "displayOrder is required." });
    }

    const order = parseInt(displayOrder);
    if (isNaN(order) || order < 0) {
      return res.status(400).json({
        message: "displayOrder must be a non-negative integer.",
      });
    }

    const docType = await DocumentType.findByIdAndUpdate(
      req.params.id,
      { $set: { displayOrder: order, updatedBy: req.admin._id } },
      { new: true }
    );

    if (!docType) {
      return res.status(404).json({ message: "Document type not found." });
    }

    return res.status(200).json({
      message: "Display order updated.",
      documentType: {
        _id:          docType._id,
        key:          docType.key,
        label:        docType.label,
        displayOrder: docType.displayOrder,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid document type ID." });
    }
    console.error("updateDisplayOrder error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── UPLOAD SAMPLE IMAGE ──────────────────────────────────────────────────────
/**
 * POST /api/admin/document-types/:id/sample-image
 * 🔒 ADMIN | SUPER_ADMIN
 * Content-Type: multipart/form-data
 * Field name: "sampleImage"
 *
 * Uploads a sample document image to Cloudinary so partners can see what
 * a correctly filled document looks like. Replaces any existing sample.
 */
export const uploadSampleImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided. Field name: sampleImage" });
    }

    const docType = await DocumentType.findById(req.params.id);
    if (!docType) {
      return res.status(404).json({ message: "Document type not found." });
    }

    // Delete the old sample image from Cloudinary before uploading the new one
    if (docType.sampleImage?.publicId) {
      await cloudinary.uploader.destroy(docType.sampleImage.publicId);
    }

    // Upload to a dedicated folder so admin assets are separate from partner uploads
    const folder = "document-types/samples";
    const publicId = `sample_${docType.key}`;

    const result = await uploadToCloudinary(req.file.buffer, folder, publicId);

    docType.sampleImage = {
      url:      result.url,
      publicId: result.publicId,
    };
    docType.updatedBy = req.admin._id;
    await docType.save();

    return res.status(200).json({
      message: "Sample image uploaded successfully.",
      sampleImage: docType.sampleImage,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid document type ID." });
    }
    console.error("uploadSampleImage error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── DELETE SAMPLE IMAGE ──────────────────────────────────────────────────────
/**
 * DELETE /api/admin/document-types/:id/sample-image
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Removes the sample image from Cloudinary and clears the field.
 */
export const deleteSampleImage = async (req, res) => {
  try {
    const docType = await DocumentType.findById(req.params.id);
    if (!docType) {
      return res.status(404).json({ message: "Document type not found." });
    }

    if (!docType.sampleImage?.publicId) {
      return res.status(400).json({ message: "This document type has no sample image." });
    }

    await cloudinary.uploader.destroy(docType.sampleImage.publicId);

    docType.sampleImage = { url: "", publicId: "" };
    docType.updatedBy   = req.admin._id;
    await docType.save();

    return res.status(200).json({
      message: "Sample image removed successfully.",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid document type ID." });
    }
    console.error("deleteSampleImage error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── DELETE DOCUMENT TYPE ─────────────────────────────────────────────────────
/**
 * DELETE /api/admin/document-types/:id
 * 🔒 SUPER_ADMIN only
 *
 * Hard delete — permanently removes the document type.
 * ONLY allowed if zero PartnerDocument records reference this type
 * (status != Superseded — Superseded records are archived, not active).
 *
 * If active uploads exist, the admin must disable (toggle) the type instead.
 * We refuse to delete a type that has upload history to protect data integrity.
 */
export const deleteDocumentType = async (req, res) => {
  try {
    const docType = await DocumentType.findById(req.params.id);
    if (!docType) {
      return res.status(404).json({ message: "Document type not found." });
    }

    // Safety check: count ALL PartnerDocument records for this type
    // (including Superseded) — if any exist, we cannot delete
    const totalUploads = await PartnerDocument.countDocuments({
      documentTypeId: docType._id,
    });

    if (totalUploads > 0) {
      return res.status(409).json({
        message:
          `Cannot delete "${docType.label}" — ${totalUploads} partner upload(s) reference this document type. ` +
          "Disable it instead using the toggle endpoint.",
        hint: `PATCH /api/admin/document-types/${docType._id}/toggle`,
      });
    }

    // Clean up Cloudinary sample image if it exists
    if (docType.sampleImage?.publicId) {
      await cloudinary.uploader.destroy(docType.sampleImage.publicId);
    }

    await DocumentType.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      message: `Document type "${docType.label}" has been permanently deleted.`,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid document type ID." });
    }
    console.error("deleteDocumentType error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
