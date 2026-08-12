import Partner from "../models/partner/Partner.js";
import PartnerTransaction from "../models/partner/partner.transaction.js";

// ─── PARTNER: Get Transaction History ────────────────────────────────────────
/**
 * GET /api/partner/transactions
 * 🔒 partner_token
 *
 * Query params:
 *   type      : "earning" | "payout" | "adjustment"
 *   status    : "pending" | "processing" | "completed" | "failed"
 *   page      : number (default 1)
 *   limit     : number (default 20)
 *   startDate : ISO date string  (filter by createdAt >=)
 *   endDate   : ISO date string  (filter by createdAt <=)
 */
export const getTransactionHistory = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20, startDate, endDate } = req.query;

    const filter = { partner: req.partnerId };
    if (type)   filter.type   = type;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      PartnerTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate("booking", "scheduledAt completedAt visitingCredit")
        .select("-__v"),
      PartnerTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      transactions,
      pagination: {
        total,
        page:       Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getTransactionHistory error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── PARTNER: Wallet Summary ──────────────────────────────────────────────────
/**
 * GET /api/partner/transactions/summary
 * 🔒 partner_token
 *
 * Returns wallet balance + lifetime totals in a single call.
 * Useful for the wallet screen header.
 */
export const getWalletSummary = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId).select(
      "walletBalance totalEarnings"
    );

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    return res.status(200).json({
      summary: {
        walletBalance:    partner.walletBalance,
        totalEarnings:    partner.totalEarnings,
        pendingPayout:    0,        // kept for API compatibility; no longer aggregated
        availableBalance: partner.walletBalance, // wallet is already net of in-flight payouts
      },
    });
  } catch (error) {
    console.error("getWalletSummary error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── PARTNER: Get Single Transaction ─────────────────────────────────────────
/**
 * GET /api/partner/transactions/:id
 * 🔒 partner_token
 */
export const getTransactionById = async (req, res) => {
  try {
    const transaction = await PartnerTransaction.findOne({
      _id:     req.params.id,
      partner: req.partnerId, // ownership guard
    })
      .populate("booking", "scheduledAt completedAt visitingCredit serviceAddress category")
      .select("-__v");

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    return res.status(200).json({ transaction });
  } catch (error) {
    console.error("getTransactionById error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── PARTNER: Request Payout ──────────────────────────────────────────────────
/**
 * POST /api/partner/transactions/payout-request
 * 🔒 partner_token
 *
 * Body: { amount }  — must be > 0 and <= availableBalance
 *
 * Creates a "payout" transaction with status "pending".
 * Admin picks it up from the payout queue and marks it completed/failed.
 * Immediately deducts from walletBalance so the partner can't double-request.
 */
export const requestPayout = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: "amount must be a positive number." });
    }

    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    // ── Guard: payout details must be present ─────────────────────────────
    const ta = partner.transactionAccount;
    const method = ta?.preferredMethod;

    if (!method) {
      return res.status(400).json({
        message: "Set up bank account or UPI details before requesting a payout.",
      });
    }
    if (method === "bank") {
      if (!ta.bankAccount?.accountNumber || !ta.bankAccount?.ifscCode) {
        return res.status(400).json({ message: "Bank account details are incomplete." });
      }
    }
    if (method === "upi" && !ta.upiId) {
      return res.status(400).json({ message: "UPI ID is not set." });
    }

    // ── Guard: sufficient balance ─────────────────────────────────────────
    // walletBalance is deducted immediately on each payout request, so it
    // already reflects all in-flight payouts. No need to subtract pendingAgg.
    const availableBalance = partner.walletBalance;

    if (Number(amount) > availableBalance) {
      return res.status(400).json({
        message: `Insufficient balance. Available: ₹${availableBalance.toFixed(2)}`,
      });
    }

    if (availableBalance <= 0) {
      return res.status(400).json({ message: "No balance available to withdraw." });
    }

    // ── Build payout details snapshot ─────────────────────────────────────
    // Mask account number to last 4 digits for audit log
    const payoutDetails =
      method === "bank"
        ? {
            method,
            accountHolderName: ta.bankAccount.accountHolderName,
            accountNumber:     `****${ta.bankAccount.accountNumber.slice(-4)}`,
            ifscCode:          ta.bankAccount.ifscCode,
            bankName:          ta.bankAccount.bankName,
            upiId:             null,
          }
        : {
            method,
            accountHolderName: null,
            accountNumber:     null,
            ifscCode:          null,
            bankName:          null,
            upiId:             ta.upiId,
          };

    // ── Deduct from wallet & create transaction atomically ────────────────
    // We deduct immediately so the balance reflects the in-flight payout.
    const newBalance = partner.walletBalance - Number(amount);

    const transaction = await PartnerTransaction.create({
      partner:      partner._id,
      type:         "payout",
      amount:       Number(amount),
      direction:    "debit",
      balanceAfter: newBalance,
      status:       "pending",
      payoutDetails,
      description:  `Payout request via ${method === "bank" ? "Bank Transfer" : "UPI"}`,
    });

    await Partner.findByIdAndUpdate(req.partnerId, {
      $inc: { walletBalance: -Number(amount) },
    });

    return res.status(201).json({
      message: "Payout request submitted. It will be processed within 2–3 business days.",
      transaction: {
        id:           transaction._id,
        amount:       transaction.amount,
        status:       transaction.status,
        payoutDetails: transaction.payoutDetails,
        createdAt:    transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("requestPayout error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── ADMIN: Get Partner Transactions ─────────────────────────────────────────
/**
 * GET /api/admin/partners/:partnerId/transactions
 * 🔒 admin_token
 *
 * Same filters as the partner-facing endpoint.
 * Admin can view any partner's history.
 */
export const adminGetPartnerTransactions = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { type, status, page = 1, limit = 20, startDate, endDate } = req.query;

    const filter = { partner: partnerId };
    if (type)   filter.type   = type;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      PartnerTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate("booking",     "scheduledAt completedAt visitingCredit")
        .populate("initiatedBy", "name email")
        .select("-__v"),
      PartnerTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      transactions,
      pagination: {
        total,
        page:       Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("adminGetPartnerTransactions error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── ADMIN: Process Payout (complete or fail) ─────────────────────────────────
/**
 * PATCH /api/admin/transactions/:id/process
 * 🔒 admin_token
 *
 * Body: { status: "completed" | "failed", failureReason? }
 *
 * If failed: reverses the wallet deduction.
 * If completed: marks the transaction done.
 */
export const adminProcessPayout = async (req, res) => {
  try {
    const { status, failureReason } = req.body;

    if (!["completed", "failed"].includes(status)) {
      return res.status(400).json({
        message: 'status must be "completed" or "failed".',
      });
    }

    const transaction = await PartnerTransaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    if (transaction.type !== "payout") {
      return res.status(400).json({ message: "Only payout transactions can be processed." });
    }
    if (!["pending", "processing"].includes(transaction.status)) {
      return res.status(400).json({
        message: `Transaction is already "${transaction.status}".`,
      });
    }

    transaction.status      = status;
    transaction.initiatedBy = req.adminId;

    if (status === "failed") {
      // Reverse the wallet deduction
      transaction.failureReason = failureReason?.trim() ?? "Payout failed";
      await Partner.findByIdAndUpdate(transaction.partner, {
        $inc: { walletBalance: transaction.amount },
      });

      // Update balanceAfter to reflect the reversal
      const partner = await Partner.findById(transaction.partner).select("walletBalance");
      transaction.balanceAfter = partner?.walletBalance ?? transaction.balanceAfter + transaction.amount;
    }

    await transaction.save();

    return res.status(200).json({
      message: `Payout marked as "${status}".`,
      transaction: {
        id:            transaction._id,
        status:        transaction.status,
        failureReason: transaction.failureReason ?? null,
      },
    });
  } catch (error) {
    console.error("adminProcessPayout error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── ADMIN: Manual Adjustment ─────────────────────────────────────────────────
/**
 * POST /api/admin/partners/:partnerId/transactions/adjust
 * 🔒 admin_token
 *
 * Body: { amount, direction: "credit"|"debit", description }
 *
 * Use for refunds, penalties, or manual corrections.
 */
export const adminAdjustBalance = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { amount, direction, description } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: "amount must be a positive number." });
    }
    if (!["credit", "debit"].includes(direction)) {
      return res.status(400).json({ message: 'direction must be "credit" or "debit".' });
    }
    if (!description?.trim()) {
      return res.status(400).json({ message: "description is required for adjustments." });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    const delta      = direction === "credit" ? Number(amount) : -Number(amount);
    const newBalance = partner.walletBalance + delta;

    if (newBalance < 0) {
      return res.status(400).json({
        message: `Debit of ₹${amount} would take balance below zero (current: ₹${partner.walletBalance}).`,
      });
    }

    const transaction = await PartnerTransaction.create({
      partner:      partnerId,
      type:         "adjustment",
      amount:       Number(amount),
      direction,
      balanceAfter: newBalance,
      status:       "completed",
      description:  description.trim(),
      initiatedBy:  req.adminId,
    });

    await Partner.findByIdAndUpdate(partnerId, {
      $inc: {
        walletBalance:  delta,
        // Credit adjustments also increase lifetime earnings
        ...(direction === "credit" && { totalEarnings: Number(amount) }),
      },
    });

    return res.status(201).json({
      message: `Balance adjusted. New balance: ₹${newBalance.toFixed(2)}`,
      transaction: {
        id:          transaction._id,
        type:        transaction.type,
        amount:      transaction.amount,
        direction:   transaction.direction,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description,
        createdAt:   transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("adminAdjustBalance error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
