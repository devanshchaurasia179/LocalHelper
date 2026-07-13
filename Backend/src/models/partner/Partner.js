import mongoose from "mongoose";
import authFields from "./partner.auth.js";
import profileFields from "./partner.profile.js";
import serviceFields from "./partner.service.js";
import documentFields from "./partner.documents.js";
import ratingFields from "./partner.rating.js";

const partnerSchema = new mongoose.Schema(
  {
    ...authFields,
    ...profileFields,
    ...serviceFields,
    ...documentFields,
    ...ratingFields,
  },
  { timestamps: true }
);

// Sparse so documents without serviceLocation are not rejected by the index
partnerSchema.index({ serviceLocation: "2dsphere" }, { sparse: true });

export default mongoose.model("Partner", partnerSchema);
