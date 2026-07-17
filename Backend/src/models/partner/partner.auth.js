import mongoose from "mongoose";

// Authentication & Verification fields
const authFields = {
  phone: {
    type: String,
    required: true,
    unique: true,
  },

  // OTP — stored as bcrypt hash, expires after 5 minutes
  phoneOtp: {
    hash: String,       // bcrypt hash of the 6-digit OTP
    expiresAt: Date,    // Date.now() + 5 min at generation time
  },

  verification: {
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    identityVerified: {
      type: Boolean,
      default: false,
    },
  },

  // ── Onboarding progress flags ──────────────────────────────────────────
  // Set to true once each step is successfully completed.
  // Flow: phone OTP → isProfile → isService → isDocument → home
  isProfile: {
    type: Boolean,
    default: false,
  },
  isService: {
    type: Boolean,
    default: false,
  },
  isDocument: {
    type: Boolean,
    default: false,
  },

  verificationStatus: {
    type: String,
    enum: ["Pending", "Under Review", "Approved", "Rejected"],
    default: "Pending",
  },
  rejectionReason: String,

  // Audit trail — who acted and when
  // Set by admin during approve/reject actions
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },

  accountStatus: {
    type: String,
    enum: ["Active", "Blocked", "Suspended"],
    default: "Active",
  },

  // ── Soft delete ────────────────────────────────────────────────────────
  // isDeleted: true means the account is "deleted" from the partner's POV
  // but the document stays in MongoDB so booking history remains intact.
  // All admin list queries must filter { isDeleted: { $ne: true } }.
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,   // indexed because every list query filters on this
  },
  deletedAt: {
    type: Date,
    default: null,
  },

  // Reason recorded when admin blocks or suspends
  // Gives context for future admins reviewing the account
  statusReason: {
    type: String,
    default: null,
  },
};

export default authFields;
