import Partner from "../models/partner/Partner.js";
import { uploadToCloudinary } from "../middleware/upload.middleware.js";
import cloudinary from "../config/cloudinary.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Aadhaar: exactly 12 digits */
const isValidAadhaar = (value) => /^\d{12}$/.test(value);

/** PAN: format ABCDE1234F */
const isValidPan = (value) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value);

// ─── SUBMIT KYC DOCUMENTS ────────────────────────────────────────────────────
/**
 * PUT /api/partner/documents/kyc
 * 🔒 Requires partner_token cookie
 *
 * Body:
 * {
 *   aadhaarNumber : "123456789012",
 *   aadhaarFront  : "<url or base64>",
 *   aadhaarBack   : "<url or base64>",
 *   panNumber     : "ABCDE1234F",
 *   panImage      : "<url or base64>"
 * }
 */
export const submitKyc = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (!partner.verification.phoneVerified) {
      return res.status(403).json({
        message: "Complete phone verification before submitting documents.",
      });
    }

    const { aadhaarNumber, panNumber } = req.body;

    // Files uploaded via multer land in req.files (keyed by field name)
    const aadhaarFrontFile = req.files?.aadhaarFront?.[0];
    const aadhaarBackFile  = req.files?.aadhaarBack?.[0];
    const panImageFile     = req.files?.panImage?.[0];
    const selfieFile       = req.files?.selfie?.[0];

    // ── Validation ────────────────────────────────────────────────────────
    if (!aadhaarNumber || !aadhaarFrontFile || !aadhaarBackFile || !selfieFile) {
      return res.status(400).json({
        message: "aadhaarNumber, aadhaarFront, aadhaarBack, and selfie are required.",
      });
    }

    if (!isValidAadhaar(aadhaarNumber)) {
      return res.status(400).json({
        message: "Invalid Aadhaar number. Must be exactly 12 digits.",
      });
    }

    if (panNumber && !isValidPan(panNumber.toUpperCase())) {
      return res.status(400).json({
        message: "Invalid PAN format. Expected format: ABCDE1234F",
      });
    }

    // ── Upload images to Cloudinary ───────────────────────────────────────
    const folder = `partners/kyc/${partner._id}`;

    const [aadhaarFrontResult, aadhaarBackResult, selfieResult] = await Promise.all([
      uploadToCloudinary(aadhaarFrontFile.buffer, folder, "aadhaar_front"),
      uploadToCloudinary(aadhaarBackFile.buffer,  folder, "aadhaar_back"),
      uploadToCloudinary(selfieFile.buffer,        folder, "selfie"),
    ]);

    const panImageResult = panImageFile
      ? await uploadToCloudinary(panImageFile.buffer, folder, "pan_card")
      : undefined;

    // ── Save ──────────────────────────────────────────────────────────────
    partner.aadhaarNumber = aadhaarNumber;
    partner.aadhaarFront  = aadhaarFrontResult;
    partner.aadhaarBack   = aadhaarBackResult;
    partner.selfie        = selfieResult;

    if (panNumber) partner.panNumber = panNumber.toUpperCase();
    if (panImageResult) partner.panImage = panImageResult;

    // Mark document step as complete
    partner.isDocument = true;

    // Mark for admin review
    if (partner.verificationStatus === "Pending") {
      partner.verificationStatus = "Under Review";
    }

    await partner.save();

    return res.status(200).json({
      message: "KYC documents submitted successfully. Under review.",
      kyc: {
        aadhaarNumber:      partner.aadhaarNumber,
        aadhaarFront:       partner.aadhaarFront?.url,
        aadhaarBack:        partner.aadhaarBack?.url,
        panNumber:          partner.panNumber,
        panImage:           partner.panImage?.url,
        selfie:             partner.selfie?.url,
        verificationStatus: partner.verificationStatus,
      },
    });
  } catch (error) {
    console.error("submitKyc error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET DOCUMENTS ────────────────────────────────────────────────────────────
/**
 * GET /api/partner/documents
 * 🔒 Requires partner_token cookie
 *
 * Returns current KYC + bank details of the logged-in partner.
 */
export const getDocuments = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId).select(
      "aadhaarNumber aadhaarFront aadhaarBack panNumber panImage selfie verification verificationStatus"
    );

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    return res.status(200).json({ documents: partner });
  } catch (error) {
    console.error("getDocuments error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── REPLACE A SINGLE KYC IMAGE ──────────────────────────────────────────────
/**
 * PATCH /api/partner/documents/kyc/:field
 * 🔒 Requires partner_token cookie
 *
 * URL param :field — one of: aadhaarFront | aadhaarBack | panImage
 * Body: multipart/form-data with the file under the same field name as :field
 *
 * - Deletes the old image from Cloudinary (using stored publicId).
 * - Uploads the new image and overwrites the DB field.
 * - Resets verificationStatus to "Under Review" so admin re-reviews.
 */

const ALLOWED_KYC_FIELDS = ["aadhaarFront", "aadhaarBack", "panImage", "selfie"];

export const replaceKycImage = async (req, res) => {
  try {
    const { field } = req.params;

    // ── Validate the field param ──────────────────────────────────────────
    if (!ALLOWED_KYC_FIELDS.includes(field)) {
      return res.status(400).json({
        message: `Invalid field. Must be one of: ${ALLOWED_KYC_FIELDS.join(", ")}`,
      });
    }

    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (!partner.verification.phoneVerified) {
      return res.status(403).json({
        message: "Complete phone verification before updating documents.",
      });
    }

    // The file arrives under req.file (upload.single middleware)
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }

    // ── Delete old image from Cloudinary if it exists ─────────────────────
    const existing = partner[field];
    if (existing?.publicId) {
      await cloudinary.uploader.destroy(existing.publicId);
    }

    // ── Upload new image ───────────────────────────────────────────────────
    // Use the same folder + publicId convention so it's predictable
    const publicIdMap = {
      aadhaarFront: "aadhaar_front",
      aadhaarBack:  "aadhaar_back",
      panImage:     "pan_card",
      selfie:       "selfie",
    };

    const folder = `partners/kyc/${partner._id}`;
    const result = await uploadToCloudinary(req.file.buffer, folder, publicIdMap[field]);

    // ── Save ──────────────────────────────────────────────────────────────
    partner[field] = result;

    // Re-queue for admin review when a document is replaced
    partner.verificationStatus = "Under Review";

    await partner.save();

    return res.status(200).json({
      message: `${field} replaced successfully. Re-submitted for review.`,
      [field]: result.url,
      verificationStatus: partner.verificationStatus,
    });
  } catch (error) {
    console.error("replaceKycImage error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
