// Authentication & Verification fields
const authFields = {
  phone: {
    type: String,
    required: true,
    unique: true,
  },

  // OTP — stored as bcrypt hash, expires after 5 minutes
  phoneOtp: {
    hash: String,      // bcrypt hash of the 6-digit OTP
    expiresAt: Date,   // Date.now() + 5 min at generation time
  },

  verification: {
    phoneVerified: {
      type: Boolean,
      default: false,
    },
  },

  // Set to true once the customer completes name/gender/address step
  isOnboarded: {
    type: Boolean,
    default: false,
  },

  accountStatus: {
    type: String,
    enum: ["Active", "Blocked", "Suspended"],
    default: "Active",
  },
};

export default authFields;
