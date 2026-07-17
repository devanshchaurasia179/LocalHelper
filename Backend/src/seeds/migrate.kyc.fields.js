/**
 * One-time migration: converts Partner KYC fields from plain string URLs
 * to the { url, publicId, ... } object shape expected by the current schema.
 *
 * Run once:
 *   node src/seeds/migrate.kyc.fields.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log("Connected to MongoDB");

const KYC_FIELDS = ["aadhaarFront", "aadhaarBack", "panImage", "selfie"];

// Find all partners where any KYC field is a plain string
const query = {
  $or: KYC_FIELDS.map((field) => ({ [field]: { $type: "string" } })),
};

const partners = await mongoose.connection.db
  .collection("partners")
  .find(query)
  .toArray();

console.log(`Found ${partners.length} partner(s) with old string KYC fields.`);

for (const partner of partners) {
  const update = {};
  for (const field of KYC_FIELDS) {
    if (typeof partner[field] === "string") {
      // Convert plain URL string → object with just url set
      update[field] = { url: partner[field], publicId: null };
      console.log(`  [${partner._id}] ${field}: "${partner[field]}" → object`);
    }
  }
  if (Object.keys(update).length > 0) {
    await mongoose.connection.db
      .collection("partners")
      .updateOne({ _id: partner._id }, { $set: update });
  }
}

console.log("Migration complete.");
await mongoose.disconnect();
