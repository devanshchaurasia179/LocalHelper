import Partner from "../models/partner/Partner.js";

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

    const { aadhaarNumber, aadhaarFront, aadhaarBack, panNumber, panImage } =
      req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!aadhaarNumber || !aadhaarFront || !aadhaarBack) {
      return res.status(400).json({
        message: "aadhaarNumber, aadhaarFront, and aadhaarBack are required.",
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

    // ── Save ──────────────────────────────────────────────────────────────
    partner.aadhaarNumber = aadhaarNumber;
    partner.aadhaarFront = aadhaarFront;
    partner.aadhaarBack = aadhaarBack;

    if (panNumber) partner.panNumber = panNumber.toUpperCase();
    if (panImage) partner.panImage = panImage;

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
        aadhaarNumber: partner.aadhaarNumber,
        aadhaarFront: partner.aadhaarFront,
        aadhaarBack: partner.aadhaarBack,
        panNumber: partner.panNumber,
        panImage: partner.panImage,
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
      "aadhaarNumber aadhaarFront aadhaarBack panNumber panImage verification verificationStatus"
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
