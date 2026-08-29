import mongoose from "mongoose";
import authFields from "./partner.auth.js";
import profileFields from "./partner.profile.js";
import serviceFields from "./partner.service.js";
import documentFields from "./partner.documents.js";
import ratingFields from "./partner.rating.js";
import transactionAccountFields from "./partner.transactionaccount.js";

const partnerSchema = new mongoose.Schema(
  {
    ...authFields,
    ...profileFields,
    ...serviceFields,
    ...documentFields,
    ...ratingFields,
    ...transactionAccountFields,
  },
  { timestamps: true }
);

// Sparse so documents without serviceLocation are not rejected by the index
partnerSchema.index({ serviceLocation: "2dsphere" }, { sparse: true });

// Admin queries filter by verificationStatus constantly — index it
partnerSchema.index({ verificationStatus: 1 });
// Note: phone index is already created by unique:true in authFields

// ─── Instance method: upsert an FCM device token ─────────────────────────────
// If the token already exists, refresh platform/updatedAt instead of duplicating.
// Caller is responsible for persisting: await partner.addFcmToken(...); partner.save()
partnerSchema.methods.addFcmToken = function (token, platform) {
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
partnerSchema.methods.removeFcmToken = function (token) {
  this.fcmTokens = this.fcmTokens.filter((t) => t.token !== token);
  return this;
};

export default mongoose.model("Partner", partnerSchema);
