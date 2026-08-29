import mongoose from "mongoose";
import authFields from "./customer.auth.js";
import profileFields from "./customer.profile.js";
import bookingFields from "./customer.booking.js";
import notificationFields from "./customer.notification.js";

const customerSchema = new mongoose.Schema(
  {
    ...authFields,
    ...profileFields,
    ...bookingFields,
    ...notificationFields,
  },
  { timestamps: true }
);

// Sparse so documents without currentLocation are not rejected by the index
customerSchema.index({ currentLocation: "2dsphere" }, { sparse: true });

// ─── Instance method: upsert an FCM device token ─────────────────────────────
// If the token already exists, refresh platform/updatedAt instead of duplicating.
// Caller is responsible for persisting: await customer.addFcmToken(...); customer.save()
customerSchema.methods.addFcmToken = function (token, platform) {
  const existing = this.fcmTokens.find((t) => t.token === token);
  if (existing) {
    existing.platform = platform;
    existing.updatedAt = new Date();
  } else {
    this.fcmTokens.push({ token, platform, updatedAt: new Date() });
  }
  return this;
};

// ─── Instance method: remove an FCM device token by its value ────────────────
customerSchema.methods.removeFcmToken = function (token) {
  this.fcmTokens = this.fcmTokens.filter((t) => t.token !== token);
  return this;
};

export default mongoose.model("Customer", customerSchema);
