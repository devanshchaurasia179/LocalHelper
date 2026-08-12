import Partner from "../models/partner/Partner.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** IFSC: 4 letters + 0 + 6 alphanumeric chars, e.g. SBIN0001234 */
const isValidIfsc = (value) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);

/** UPI: localpart@provider, e.g. 9876543210@upi or name@okaxis */
const isValidUpi = (value) => /^[\w.\-+]+@[a-zA-Z]+$/.test(value);

// ─── GET TRANSACTION ACCOUNT ──────────────────────────────────────────────────
/**
 * GET /api/partner/transaction-account
 * 🔒 Requires partner_token cookie
 *
 * Returns the partner's saved payout details.
 */
export const getTransactionAccount = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId).select(
      "transactionAccount"
    );

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    return res.status(200).json({
      transactionAccount: partner.transactionAccount ?? null,
    });
  } catch (error) {
    console.error("getTransactionAccount error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── SAVE / UPDATE BANK ACCOUNT ───────────────────────────────────────────────
/**
 * PUT /api/partner/transaction-account/bank
 * 🔒 Requires partner_token cookie
 *
 * Body:
 * {
 *   accountHolderName : "Ravi Kumar",
 *   accountNumber     : "123456789012",
 *   ifscCode          : "SBIN0001234",
 *   bankName          : "State Bank of India",
 *   branchName        : "MG Road"       // optional
 * }
 *
 * Sets preferredMethod to "bank" if no method is already selected.
 * Resets isVerified to false so admin/payment gateway re-verifies.
 */
export const saveBankAccount = async (req, res) => {
  try {
    const { accountHolderName, accountNumber, ifscCode, bankName, branchName } =
      req.body;

    // ── Required field validation ─────────────────────────────────────────
    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({
        message:
          "accountHolderName, accountNumber, ifscCode, and bankName are required.",
      });
    }

    if (!isValidIfsc(ifscCode.toUpperCase())) {
      return res.status(400).json({
        message: "Invalid IFSC code. Expected format: SBIN0001234",
      });
    }

    if (!/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({
        message: "Account number must be 9–18 digits.",
      });
    }

    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    // ── Update fields ─────────────────────────────────────────────────────
    if (!partner.transactionAccount) partner.transactionAccount = {};

    partner.transactionAccount.bankAccount = {
      accountHolderName: accountHolderName.trim(),
      accountNumber:     accountNumber.trim(),
      ifscCode:          ifscCode.trim().toUpperCase(),
      bankName:          bankName.trim(),
      branchName:        branchName?.trim() ?? null,
    };

    // Default preferred method to bank if not already set
    if (!partner.transactionAccount.preferredMethod) {
      partner.transactionAccount.preferredMethod = "bank";
    }

    // Changing details requires re-verification
    partner.transactionAccount.isVerified = false;
    partner.transactionAccount.verifiedAt = null;

    partner.markModified("transactionAccount");
    await partner.save();

    return res.status(200).json({
      message: "Bank account saved successfully.",
      transactionAccount: partner.transactionAccount,
    });
  } catch (error) {
    console.error("saveBankAccount error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── SAVE / UPDATE UPI ID ─────────────────────────────────────────────────────
/**
 * PUT /api/partner/transaction-account/upi
 * 🔒 Requires partner_token cookie
 *
 * Body: { upiId: "9876543210@upi" }
 *
 * Sets preferredMethod to "upi" if no method is already selected.
 * Resets isVerified to false so admin/payment gateway re-verifies.
 */
export const saveUpiId = async (req, res) => {
  try {
    const { upiId } = req.body;

    if (!upiId) {
      return res.status(400).json({ message: "upiId is required." });
    }

    if (!isValidUpi(upiId.trim())) {
      return res.status(400).json({
        message: "Invalid UPI ID format. Expected: localpart@provider",
      });
    }

    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (!partner.transactionAccount) partner.transactionAccount = {};

    partner.transactionAccount.upiId = upiId.trim();

    // Default preferred method to upi if not already set
    if (!partner.transactionAccount.preferredMethod) {
      partner.transactionAccount.preferredMethod = "upi";
    }

    // Changing details requires re-verification
    partner.transactionAccount.isVerified = false;
    partner.transactionAccount.verifiedAt = null;

    partner.markModified("transactionAccount");
    await partner.save();

    return res.status(200).json({
      message: "UPI ID saved successfully.",
      transactionAccount: partner.transactionAccount,
    });
  } catch (error) {
    console.error("saveUpiId error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── SET PREFERRED PAYOUT METHOD ─────────────────────────────────────────────
/**
 * PATCH /api/partner/transaction-account/preferred-method
 * 🔒 Requires partner_token cookie
 *
 * Body: { method: "bank" | "upi" }
 *
 * Validates that the chosen method has actually been saved before switching.
 */
export const setPreferredMethod = async (req, res) => {
  try {
    const { method } = req.body;

    if (!method || !["bank", "upi"].includes(method)) {
      return res.status(400).json({
        message: 'method must be either "bank" or "upi".',
      });
    }

    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    const ta = partner.transactionAccount;

    // Guard: the chosen method must have data saved first
    if (method === "bank") {
      const ba = ta?.bankAccount;
      if (!ba?.accountNumber || !ba?.ifscCode) {
        return res.status(400).json({
          message: "Save bank account details before setting it as the preferred method.",
        });
      }
    }

    if (method === "upi") {
      if (!ta?.upiId) {
        return res.status(400).json({
          message: "Save a UPI ID before setting it as the preferred method.",
        });
      }
    }

    if (!partner.transactionAccount) partner.transactionAccount = {};
    partner.transactionAccount.preferredMethod = method;

    partner.markModified("transactionAccount");
    await partner.save();

    return res.status(200).json({
      message: `Preferred payout method set to "${method}".`,
      preferredMethod: partner.transactionAccount.preferredMethod,
    });
  } catch (error) {
    console.error("setPreferredMethod error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── DELETE BANK ACCOUNT ──────────────────────────────────────────────────────
/**
 * DELETE /api/partner/transaction-account/bank
 * 🔒 Requires partner_token cookie
 *
 * Clears bank account details.
 * If preferredMethod was "bank", resets it to "upi" (if UPI exists) or null.
 */
export const deleteBankAccount = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (!partner.transactionAccount?.bankAccount?.accountNumber) {
      return res.status(404).json({ message: "No bank account found to delete." });
    }

    partner.transactionAccount.bankAccount = {
      accountHolderName: null,
      accountNumber:     null,
      ifscCode:          null,
      bankName:          null,
      branchName:        null,
    };

    // Adjust preferred method if it was pointing to the deleted bank account
    if (partner.transactionAccount.preferredMethod === "bank") {
      partner.transactionAccount.preferredMethod = partner.transactionAccount.upiId
        ? "upi"
        : null;
    }

    partner.transactionAccount.isVerified = false;
    partner.transactionAccount.verifiedAt = null;

    partner.markModified("transactionAccount");
    await partner.save();

    return res.status(200).json({
      message: "Bank account removed successfully.",
      transactionAccount: partner.transactionAccount,
    });
  } catch (error) {
    console.error("deleteBankAccount error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── DELETE UPI ID ────────────────────────────────────────────────────────────
/**
 * DELETE /api/partner/transaction-account/upi
 * 🔒 Requires partner_token cookie
 *
 * Clears the UPI ID.
 * If preferredMethod was "upi", resets it to "bank" (if bank exists) or null.
 */
export const deleteUpiId = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (!partner.transactionAccount?.upiId) {
      return res.status(404).json({ message: "No UPI ID found to delete." });
    }

    partner.transactionAccount.upiId = null;

    // Adjust preferred method if it was pointing to the deleted UPI ID
    if (partner.transactionAccount.preferredMethod === "upi") {
      const ba = partner.transactionAccount.bankAccount;
      partner.transactionAccount.preferredMethod =
        ba?.accountNumber ? "bank" : null;
    }

    partner.transactionAccount.isVerified = false;
    partner.transactionAccount.verifiedAt = null;

    partner.markModified("transactionAccount");
    await partner.save();

    return res.status(200).json({
      message: "UPI ID removed successfully.",
      transactionAccount: partner.transactionAccount,
    });
  } catch (error) {
    console.error("deleteUpiId error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
