/**
 * Document Types Seed
 *
 * Bootstraps the initial DocumentType records that replace the old hardcoded
 * aadhaarFront / aadhaarBack / panImage / selfie fields on the Partner model.
 *
 * Run once after deploying the new schema:
 *   node src/seeds/documentTypes.seed.js
 *
 * Safe to re-run — uses upsert on `key` so it won't create duplicates.
 * It WILL update fields if the seed data changes (useful for initial setup).
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../lib/db.js";
import DocumentType from "../models/verification/DocumentType.js";
import dns from "dns";
dotenv.config();
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const SEED_DATA = [
  // ── Aadhaar Front ──────────────────────────────────────────────────────────
  {
    key: "aadhaar_front",
    label: "Aadhaar Card (Front)",
    description: "Front side of your Aadhaar card showing your name and photo.",
    helpText:
      "Upload a clear, well-lit photo of the front of your Aadhaar card. " +
      "All four corners should be visible.",
    uploadInstructions:
      "1. Place your Aadhaar card on a flat surface.\n" +
      "2. Ensure good lighting with no shadows.\n" +
      "3. All four corners must be visible.\n" +
      "4. The text must be clearly readable.",
    hasNumberField: true,
    numberFieldLabel: "Aadhaar Number",
    numberFieldPlaceholder: "Enter your 12-digit Aadhaar number",
    numberFieldValidationRegex: "^\\d{12}$",
    numberFieldValidationMessage: "Aadhaar number must be exactly 12 digits.",
    acceptedFileTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    maxFileSizeMB: 5,
    isMultiPage: true,
    isRequired: true,
    icon: "id-card",
    displayOrder: 10,
  },

  // ── Aadhaar Back ───────────────────────────────────────────────────────────
  {
    key: "aadhaar_back",
    label: "Aadhaar Card (Back)",
    description: "Back side of your Aadhaar card showing your address.",
    helpText:
      "Upload a clear photo of the back of your Aadhaar card. " +
      "Your address must be clearly visible.",
    uploadInstructions:
      "1. Place the back of your Aadhaar card on a flat surface.\n" +
      "2. Ensure the address text is sharp and readable.\n" +
      "3. Avoid glare or shadows.",
    hasNumberField: false,
    acceptedFileTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    maxFileSizeMB: 5,
    isMultiPage: true,
    isRequired: true,
    icon: "id-card",
    displayOrder: 20,
  },

  // ── PAN Card ───────────────────────────────────────────────────────────────
  {
    key: "pan_card",
    label: "PAN Card",
    description: "Your Permanent Account Number (PAN) card for tax identity verification.",
    helpText:
      "Upload a clear photo of your PAN card. " +
      "The 10-character PAN number must be clearly visible.",
    uploadInstructions:
      "1. Place your PAN card on a flat surface.\n" +
      "2. Ensure the PAN number is sharp and readable.\n" +
      "3. Your name and date of birth must also be visible.",
    hasNumberField: true,
    numberFieldLabel: "PAN Number",
    numberFieldPlaceholder: "E.g. ABCDE1234F",
    numberFieldValidationRegex: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$",
    numberFieldValidationMessage: "PAN must be in format ABCDE1234F (5 letters, 4 digits, 1 letter).",
    acceptedFileTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    maxFileSizeMB: 5,
    isMultiPage: false,
    isRequired: false,   // optional in the existing system
    icon: "credit-card",
    displayOrder: 30,
  },

  // ── Selfie ─────────────────────────────────────────────────────────────────
  {
    key: "selfie",
    label: "Live Selfie",
    description: "A clear selfie for identity verification.",
    helpText:
      "Take a selfie in good lighting. Your face must be clearly visible. " +
      "No sunglasses, hats, or face coverings.",
    uploadInstructions:
      "1. Find a well-lit area (natural light works best).\n" +
      "2. Look directly at the camera.\n" +
      "3. Remove sunglasses, hats, or anything covering your face.\n" +
      "4. Make sure your full face is in the frame.",
    hasNumberField: false,
    acceptedFileTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    maxFileSizeMB: 5,
    isMultiPage: false,
    isRequired: true,
    icon: "camera",
    displayOrder: 40,
  },
];

const seed = async () => {
  await connectDB();

  console.log("🌱 Seeding document types...\n");

  let created = 0;
  let updated = 0;

  for (const data of SEED_DATA) {
    const result = await DocumentType.findOneAndUpdate(
      { key: data.key },           // match by key
      { $set: data },              // update all fields
      {
        upsert: true,              // create if not found
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // Mongoose sets this on upsert — if the doc was just created, updatedAt ≈ createdAt
    const wasCreated =
      result.createdAt.getTime() === result.updatedAt.getTime() ||
      // Fallback: if it was created within the last 2 seconds
      Date.now() - result.createdAt.getTime() < 2000;

    if (wasCreated) {
      created++;
      console.log(`  ✅ Created: ${result.label} (key: ${result.key})`);
    } else {
      updated++;
      console.log(`  🔄 Updated: ${result.label} (key: ${result.key})`);
    }
  }

  console.log(`\n✅ Seed complete. Created: ${created}, Updated: ${updated}`);
  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  mongoose.disconnect();
  process.exit(1);
});
