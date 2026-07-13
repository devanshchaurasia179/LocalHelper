import mongoose from "mongoose";
import authFields from "./customer.auth.js";
import profileFields from "./customer.profile.js";
import bookingFields from "./customer.booking.js";

const customerSchema = new mongoose.Schema(
  {
    ...authFields,
    ...profileFields,
    ...bookingFields,
  },
  { timestamps: true }
);

// Sparse so documents without currentLocation are not rejected by the index
customerSchema.index({ currentLocation: "2dsphere" }, { sparse: true });

export default mongoose.model("Customer", customerSchema);
