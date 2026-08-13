import mongoose from "mongoose";

/**
 * CustomerTransaction — one document per financial event for a customer.
 *
 * Types:
 *   topup      — money added to wallet (payment gateway, admin credit)
 *   booking    — money deducted from wallet for a booking payment
 *   refund     — money returned to wallet (cancelled/failed booking)
 *   adjustment — manual credit/debit by admin (compensation, penalty, correction)
 *
 * Status:
 *   pending    — transaction initiated, not yet confirmed
 *   processing — being processed by payment gateway
 *   completed  — successfully completed
 *   failed     — transaction failed; wallet balance not affected or reversed
 */
const customerTransactionSchema = new mongoose.Schema(
  {
    // ── Customer ─────────────────────────────────────────────────────────────
    customer: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Customer",
      required: true,
      index:    true,
    },

    // ── Type ─────────────────────────────────────────────────────────────────
    type: {
      type:     String,
      enum:     ["topup", "booking", "refund", "adjustment","call","chat"],
      required: true,
      index:    true,
    },

    // ── Amount ───────────────────────────────────────────────────────────────
    // Always positive. Direction is inferred from type:
    //   topup / refund / adjustment(credit) → adds to wallet
    //   booking / adjustment(debit)         → deducts from wallet
    amount: {
      type:     Number,
      required: true,
      min:      0,
    },

    // ── Direction ────────────────────────────────────────────────────────────
    // "credit" adds to wallet, "debit" deducts.
    // For topup/refund → always credit. For booking → always debit.
    direction: {
      type:    String,
      enum:    ["credit", "debit"],
      required: true,
    },

    // ── Wallet snapshot after this transaction ───────────────────────────────
    // Stored at write time so we can reconstruct the ledger without summing.
    balanceAfter: {
      type: Number,
      required: true,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ["pending", "processing", "completed", "failed"],
      default: "completed",
      index:   true,
    },

    // ── Reference to the booking (booking/refund only) ───────────────────────
    booking: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Booking",
      default: null,
    },

    // ── Payment gateway details (topup only) ─────────────────────────────────
    paymentDetails: {
      gateway:        { type: String, default: null }, // e.g., "razorpay", "stripe"
      gatewayOrderId: { type: String, default: null },
      gatewayPaymentId: { type: String, default: null },
      paymentMethod:  { type: String, default: null }, // e.g., "card", "upi", "netbanking"
    },

    // ── Description visible to the customer ──────────────────────────────────
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Admin who triggered the transaction (adjustments only) ───────────────
    initiatedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Admin",
      default: null,
    },

    // ── Failure reason ───────────────────────────────────────────────────────
    failureReason: {
      type:    String,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Most common query: customer's transaction history newest first
customerTransactionSchema.index({ customer: 1, createdAt: -1 });

// Admin transaction management: filter by type and status
customerTransactionSchema.index({ type: 1, status: 1, createdAt: -1 });

// Query by booking reference
customerTransactionSchema.index({ booking: 1 });

export default mongoose.model("CustomerTransaction", customerTransactionSchema);
