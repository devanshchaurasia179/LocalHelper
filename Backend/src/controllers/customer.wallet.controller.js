import Customer from "../models/customer/Customer.js";
import CustomerTransaction from "../models/customer/customer.wallet.js";

// ─── Helper: build service label from booking ─────────────────────────────────
/**
 * Given a populated booking object (with category.name and category.subcategories),
 * returns a human-readable service label like "Home Service - Electrician".
 * Falls back to just the category name if no subcategory is found.
 */
function buildServiceLabel(booking) {
  if (!booking?.category) return null;
  const catName = booking.category.name ?? "";
  if (!booking.subcategoryId) return catName;
  const sub = (booking.category.subcategories ?? []).find(
    (s) => s._id.toString() === booking.subcategoryId.toString()
  );
  return sub?.name ? `${catName} - ${sub.name}` : catName;
}

// ─── CUSTOMER: Get Transaction History ───────────────────────────────────────
/**
 * GET /api/customer/transactions
 * 🔒 customer_token
 *
 * Query params:
 *   type      : "topup" | "booking" | "refund" | "adjustment" | "call" | "chat"
 *   status    : "pending" | "processing" | "completed" | "failed"
 *   page      : number (default 1)
 *   limit     : number (default 20)
 *   startDate : ISO date string  (filter by createdAt >=)
 *   endDate   : ISO date string  (filter by createdAt <=)
 */
export const getTransactionHistory = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20, startDate, endDate } = req.query;

    const filter = { customer: req.customerId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      CustomerTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate({
          path: "booking",
          select: "scheduledAt completedAt visitingCredit serviceAddress partner category subcategoryId description status",
          populate: [
            { path: "partner", select: "name phone" },
            { path: "category", select: "name subcategories" },
          ],
        })
        .select("-__v")
        .lean(),
      CustomerTransaction.countDocuments(filter),
    ]);

    // Attach computed serviceLabel to each booking
    const enriched = transactions.map((tx) => {
      if (tx.booking) {
        tx.booking.serviceLabel = buildServiceLabel(tx.booking);
      }
      return tx;
    });

    return res.status(200).json({
      transactions: enriched,
      pagination: {
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getTransactionHistory error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── CUSTOMER: Wallet Summary ─────────────────────────────────────────────────
/**
 * GET /api/customer/transactions/summary
 * 🔒 customer_token
 *
 * Returns wallet balance + lifetime totals in a single call.
 * Useful for the wallet screen header.
 */
export const getWalletSummary = async (req, res) => {
  try {
    const customer = await Customer.findById(req.customerId).select("walletBalance");

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    // Calculate aggregates
    const aggregates = await CustomerTransaction.aggregate([
      { $match: { customer: customer._id, status: "completed" } },
      {
        $group: {
          _id: null,
          totalTopups: {
            $sum: {
              $cond: [{ $eq: ["$type", "topup"] }, "$amount", 0],
            },
          },
          totalSpent: {
            $sum: {
              $cond: [
                { $in: ["$type", ["booking", "call", "chat"]] },
                "$amount",
                0,
              ],
            },
          },
          totalRefunds: {
            $sum: {
              $cond: [{ $eq: ["$type", "refund"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const stats = aggregates[0] || { totalTopups: 0, totalSpent: 0, totalRefunds: 0 };

    return res.status(200).json({
      summary: {
        walletBalance: customer.walletBalance,
        totalTopups: stats.totalTopups,
        totalSpent: stats.totalSpent,
        totalRefunds: stats.totalRefunds,
      },
    });
  } catch (error) {
    console.error("getWalletSummary error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── CUSTOMER: Get Single Transaction ────────────────────────────────────────
/**
 * GET /api/customer/transactions/:id
 * 🔒 customer_token
 */
export const getTransactionById = async (req, res) => {
  try {
    const transaction = await CustomerTransaction.findOne({
      _id: req.params.id,
      customer: req.customerId, // ownership guard
    })
      .populate({
        path: "booking",
        select: "scheduledAt completedAt visitingCredit serviceAddress partner category subcategoryId description status",
        populate: [
          { path: "partner", select: "name phone" },
          { path: "category", select: "name subcategories" },
        ],
      })
      .select("-__v")
      .lean();

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // Attach computed serviceLabel
    if (transaction.booking) {
      transaction.booking.serviceLabel = buildServiceLabel(transaction.booking);
    }

    return res.status(200).json({ transaction });
  } catch (error) {
    console.error("getTransactionById error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── CUSTOMER: Wallet Topup ───────────────────────────────────────────────────
/**
 * POST /api/customer/transactions/topup
 * 🔒 customer_token
 *
 * Body: { amount }  — must be > 0
 *
 * Immediately credits the customer's wallet and records a completed transaction.
 * Payment gateway integration will be added later — this endpoint will then
 * become the gateway webhook handler and the balance update will move there.
 */
export const initiateTopup = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: "amount must be a positive number." });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const topupAmount = Number(amount);
    const newBalance  = customer.walletBalance + topupAmount;

    // Credit wallet and record transaction atomically
    const [transaction] = await Promise.all([
      CustomerTransaction.create({
        customer:     customer._id,
        type:         "topup",
        amount:       topupAmount,
        direction:    "credit",
        balanceAfter: newBalance,
        status:       "completed",
        description:  `Wallet topup of ₹${topupAmount}`,
      }),
      Customer.findByIdAndUpdate(customer._id, {
        $inc: { walletBalance: topupAmount },
      }),
    ]);

    return res.status(201).json({
      message: `₹${topupAmount} added to wallet.`,
      transaction: {
        id:           transaction._id,
        amount:       transaction.amount,
        balanceAfter: newBalance,
        status:       transaction.status,
        createdAt:    transaction.createdAt,
      },
      walletBalance: newBalance,
    });
  } catch (error) {
    console.error("initiateTopup error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── INTERNAL: Create Booking Transaction ─────────────────────────────────────
/**
 * Called internally when a booking is created/paid.
 * Deducts amount from customer wallet and creates a transaction record.
 *
 * @param {ObjectId} customerId
 * @param {ObjectId} bookingId
 * @param {Number} amount
 * @param {String} description
 * @returns {Promise<Transaction>}
 */
export const createBookingTransaction = async (customerId, bookingId, amount, description) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error("Customer not found");

  if (customer.walletBalance < amount) {
    throw new Error("Insufficient wallet balance");
  }

  const newBalance = customer.walletBalance - amount;

  const transaction = await CustomerTransaction.create({
    customer: customerId,
    type: "booking",
    amount,
    direction: "debit",
    balanceAfter: newBalance,
    status: "completed",
    booking: bookingId,
    description: description || `Booking payment`,
  });

  await Customer.findByIdAndUpdate(customerId, {
    $inc: { walletBalance: -amount },
  });

  return transaction;
};

// ─── INTERNAL: Create Refund Transaction ──────────────────────────────────────
/**
 * Called internally when a booking is cancelled/refunded.
 * Adds amount back to customer wallet and creates a transaction record.
 *
 * @param {ObjectId} customerId
 * @param {ObjectId} bookingId
 * @param {Number} amount
 * @param {String} description
 * @returns {Promise<Transaction>}
 */
export const createRefundTransaction = async (customerId, bookingId, amount, description) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error("Customer not found");

  const newBalance = customer.walletBalance + amount;

  const transaction = await CustomerTransaction.create({
    customer: customerId,
    type: "refund",
    amount,
    direction: "credit",
    balanceAfter: newBalance,
    status: "completed",
    booking: bookingId,
    description: description || `Booking refund`,
  });

  await Customer.findByIdAndUpdate(customerId, {
    $inc: { walletBalance: amount },
  });

  return transaction;
};

// ─── INTERNAL: Create Call/Chat Transaction ───────────────────────────────────
/**
 * Called internally when a customer makes a call or sends a chat to a partner.
 * Deducts charges from customer wallet.
 *
 * @param {ObjectId} customerId
 * @param {ObjectId} partnerId
 * @param {String} type - "call" | "chat"
 * @param {Number} amount
 * @param {String} description
 * @returns {Promise<Transaction>}
 */
export const createCommunicationTransaction = async (customerId, partnerId, type, amount, description) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error("Customer not found");

  if (customer.walletBalance < amount) {
    throw new Error("Insufficient wallet balance");
  }

  const newBalance = customer.walletBalance - amount;

  const transaction = await CustomerTransaction.create({
    customer: customerId,
    type, // "call" or "chat"
    amount,
    direction: "debit",
    balanceAfter: newBalance,
    status: "completed",
    description: description || `${type === "call" ? "Call" : "Chat"} charges`,
  });

  await Customer.findByIdAndUpdate(customerId, {
    $inc: { walletBalance: -amount },
  });

  return transaction;
};

// ─── ADMIN: Get Customer Transactions ────────────────────────────────────────
/**
 * GET /api/admin/customers/:customerId/transactions
 * 🔒 admin_token
 *
 * Same filters as the customer-facing endpoint.
 * Admin can view any customer's history.
 */
export const adminGetCustomerTransactions = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { type, status, page = 1, limit = 20, startDate, endDate } = req.query;

    const filter = { customer: customerId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      CustomerTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate("booking", "scheduledAt completedAt visitingCredit status")
        .populate("initiatedBy", "name email")
        .select("-__v"),
      CustomerTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      transactions,
      pagination: {
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("adminGetCustomerTransactions error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── ADMIN: Manual Adjustment ─────────────────────────────────────────────────
/**
 * POST /api/admin/customers/:customerId/transactions/adjust
 * 🔒 admin_token
 *
 * Body: { amount, direction: "credit"|"debit", description }
 *
 * Use for refunds, compensations, penalties, or manual corrections.
 */
export const adminAdjustBalance = async (req, res) => {
  try {
    const { customerId } = req.params;
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

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const delta = direction === "credit" ? Number(amount) : -Number(amount);
    const newBalance = customer.walletBalance + delta;

    if (newBalance < 0) {
      return res.status(400).json({
        message: `Debit of ₹${amount} would take balance below zero (current: ₹${customer.walletBalance}).`,
      });
    }

    const transaction = await CustomerTransaction.create({
      customer: customerId,
      type: "adjustment",
      amount: Number(amount),
      direction,
      balanceAfter: newBalance,
      status: "completed",
      description: description.trim(),
      initiatedBy: req.adminId,
    });

    await Customer.findByIdAndUpdate(customerId, {
      $inc: { walletBalance: delta },
    });

    return res.status(201).json({
      message: `Balance adjusted. New balance: ₹${newBalance.toFixed(2)}`,
      transaction: {
        id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        direction: transaction.direction,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("adminAdjustBalance error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
