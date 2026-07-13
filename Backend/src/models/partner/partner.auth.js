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
  accountStatus: {
    type: String,
    enum: ["Active", "Blocked", "Suspended"],
    default: "Active",
  },
};

export default authFields;
