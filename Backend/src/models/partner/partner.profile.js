import mongoose from "mongoose";

// Personal Information & Address fields
const profileFields = {
  fullName: {
    type: String,
    trim: true,
    default: "",
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
  },
  dateOfBirth: Date,
  profilePhoto: String,
  selfiePhoto: String,
  address: {
    house: String,
    street: String,
    locality: String,
    city: String,
    state: String,
    pincode: String,
  },

  // Customers this partner has blocked — prevents them from calling each other
  blockedCustomers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
  ],

  // ── Wallet & Earnings ─────────────────────────────────────────────────────
  // Moved from rating.js since these are financial account data, not ratings.
  walletBalance: {
    type: Number,
    default: 0,
  },
  totalEarnings: {
    type: Number,
    default: 0,
  },
};

export default profileFields;
