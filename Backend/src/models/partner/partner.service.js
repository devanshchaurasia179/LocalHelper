import mongoose from "mongoose";

// Service, Professional Details, Pricing & Availability fields
const serviceFields = {
  // Service Location (2dsphere index applied in main model)
  // No defaults here — keep the field absent until partner sets it.
  // A default on the nested "type" field causes Mongoose to create
  // { type: "Point" } with no coordinates, which MongoDB rejects.
  serviceLocation: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    },
  },
  serviceRadius: {
    type: Number,
    default: 10, // km
  },

  // Professional Details
  categories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
  ],
  subcategories: [
    {
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
      },
      subcategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
    },
  ],
  experience: Number,
  languages: [String],
  bio: String,

  // Pricing
  visitingCredits: {
    type: {
      type: String,
      enum: ["perVisit", "perHour", "perDay", "perWeek"],
      default: "perVisit",
    },
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  chatCharges: {
    type: Number,
    min: 0,
    default: 0,
  },
  // callCharges: amount charged per durationMinutes of a call
  // e.g. { amount: 20, durationMinutes: 10 } = ₹20 per 10 minutes
  callCharges: {
    amount: {
      type: Number,
      min: 0,
      default: 10,
    },
    durationMinutes: {
      type: Number,
      min: 1,
      default: 10, // minutes covered by the charge
    },
  },
  // Availability
  isOnline: {
    type: Boolean,
    default: false,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  workingDays: [
    {
      _id: false,
      day: String,
    },
  ],
};

export default serviceFields;
