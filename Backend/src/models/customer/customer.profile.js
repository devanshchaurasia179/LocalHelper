// Personal Information & Address fields
const profileFields = {
  name: {
    type: String,
    trim: true,
  },

  gender: {
    type: String,
  },

  email: {
    type: String,
    trim: true,
    lowercase: true,
  },

  // Wallet Balance
  walletBalance: {
    type: Number,
    default: 0,
    min: 0,
  },

  // GeoJSON Point — used for finding nearby services
  // No defaults here — keep the field absent until customer sets it.
  // A default on the nested "type" field causes Mongoose to create
  // { type: "Point" } with no coordinates, which MongoDB rejects.
  currentLocation: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    },
  },

  // Multiple saved addresses — label is a free string (e.g. "Home", "Office", "Mom's Place")
  addresses: [
    {
      label: {
        type: String,
        trim: true,
      },
      house: String,
      street: String,
      locality: String,
      city: String,
      state: String,
      pincode: String,

      // GeoJSON Point for this specific address — set when the user saves/selects it.
      // Kept absent (no default) until coordinates are known, to avoid a
      // { type: "Point" } stub with no coordinates which MongoDB would reject.
      location: {
        type: {
          type: String,
          enum: ["Point"],
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
        },
      },
    },
  ],
};

export default profileFields;
