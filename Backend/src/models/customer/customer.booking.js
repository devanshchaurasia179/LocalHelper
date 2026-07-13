import mongoose from "mongoose";

// Bookings & Rating fields
const bookingFields = {
  bookings: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
  ],

  averageRating: {
    type: Number,
    default: 0,
  },
  totalReviews: {
    type: Number,
    default: 0,
  },
};

export default bookingFields;
