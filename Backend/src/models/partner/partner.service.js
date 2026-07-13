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
  skills: [String],
  experience: Number,
  languages: [String],
  bio: String,

  // Pricing
  visitingCredits: Number,
  emergencyAvailable: {
    type: Boolean,
    default: false,
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
      startTime: String,
      endTime: String,
    },
  ],
};

export default serviceFields;
