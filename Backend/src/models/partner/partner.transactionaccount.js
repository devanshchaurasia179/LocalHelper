// Transaction Account fields
// Stores the partner's payout details used to transfer earnings.
// Either a bank account OR a UPI ID must be present before a payout can be triggered.
const transactionAccountFields = {
  transactionAccount: {
    // ── Bank Account ──────────────────────────────────────────────────────
    bankAccount: {
      accountHolderName: {
        type: String,
        trim: true,
        default: null,
      },
      accountNumber: {
        type: String,
        trim: true,
        default: null,
      },
      ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },
      bankName: {
        type: String,
        trim: true,
        default: null,
      },
      // Branch name is optional but useful for manual verification
      branchName: {
        type: String,
        trim: true,
        default: null,
      },
    },

    // ── UPI ───────────────────────────────────────────────────────────────
    upiId: {
      type: String,
      trim: true,
      default: null,
      // Basic UPI format: localpart@provider  (e.g. 9876543210@upi)
      match: [/^[\w.\-+]+@[a-zA-Z]+$/, "Invalid UPI ID format"],
    },

    // Which method the partner prefers for payouts
    preferredMethod: {
      type: String,
      enum: ["bank", "upi", null],
      default: null,
    },

    // Whether the payout details have been verified by admin / payment gateway
    isVerified: {
      type: Boolean,
      default: false,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
};

export default transactionAccountFields;
