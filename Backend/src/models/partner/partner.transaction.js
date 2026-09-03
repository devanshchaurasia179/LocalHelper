import mongoose from "mongoose";

/**
 * PartnerTransaction — one document per financial event for a partner.
 *
 * Types:
 *   topup        — money added to wallet (payment gateway, direct deposit)
 *   earning      — money added to wallet when a booking is completed
 *   payout       — money withdrawn from wallet to bank/UPI
 *   adjustment   — manual credit/debit by admin (refund, penalty, correction)
 *   call_charge  — call charges deducted from wallet
 *   chat_charge  — chat charges deducted from wallet
 *
 * Status (only relevant for payouts):
 *   pending    — payout initiated, not yet processed
 *   processing — sent to payment gateway
 *   completed  — successfully transferred
 *   failed     — transfer failed; wallet balance reversed
 */
const partnerTransactionSchema = new mongoose.Schema(
  {
    // ── Partner ──────────────────────────────────────────────────────────────
    partner: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Partner",
      required: true,
      index:    true,
    },

    // ── Type ─────────────────────────────────────────────────────────────────
    type: {
      type:     String,
      enum:     ["topup", "earning", "payout", "adjustment", "call_charge", "chat_charge"],
      required: true,
      index:    true,
    },

    // ── Amount ───────────────────────────────────────────────────────────────
    // Always positive. Direction is inferred from type:
    //   topup / earning / adjustment(credit) → adds to wallet
    //   payout  / adjustment(debit) / call_charge / chat_charge → deducts from wallet
    amount: {
      type:     Number,
      required: true,
      min:      0,
    },

    // ── Direction ────────────────────────────────────────────────────────────
    // "credit" adds to wallet, "debit" deducts.
    // For topup/earning → always credit. For payout/call_charge/chat_charge → always debit.
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
    // Only meaningful for payout; set to "completed" immediately for topup/earning/adjustment.
    status: {
      type:    String,
      enum:    ["pending", "processing", "completed", "failed"],
      default: "completed",
      index:   true,
    },

    // ── Reference to the source booking (earnings only) ──────────────────────
    booking: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Booking",
      default: null,
    },

    // ── Payout details snapshot (payouts only) ───────────────────────────────
    // Snapshot the method + destination at payout time so the record is
    // self-contained even if the partner later edits their payout details.
    payoutDetails: {
      method:            { type: String, enum: ["bank", "upi", null], default: null },
      accountHolderName: { type: String, default: null },
      accountNumber:     { type: String, default: null }, // last 4 digits only — stored masked
      ifscCode:          { type: String, default: null },
      bankName:          { type: String, default: null },
      upiId:             { type: String, default: null },
    },

    // ── Description visible to the partner ───────────────────────────────────
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Admin who triggered the transaction (payouts / adjustments) ──────────
    initiatedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Admin",
      default: null,
    },

    // ── Failure reason (payouts only) ─────────────────────────────────────────
    failureReason: {
      type:    String,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Most common query: partner's history newest first
partnerTransactionSchema.index({ partner: 1, createdAt: -1 });

// Admin payout queue: pending payouts across all partners
partnerTransactionSchema.index({ type: 1, status: 1, createdAt: -1 });

export default mongoose.model("PartnerTransaction", partnerTransactionSchema);
