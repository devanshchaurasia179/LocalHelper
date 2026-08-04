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
 *
 * ── Category IDs (from DB) ────────────────────────────────────────────────────
 *   Electrician : 6a5d67a6ccd37630b9bfca67
 *   Driver      : 6a5fcd70a42e2534927a4717
 *   Mechanic    : 6a5fd9d2c5e4dc206c1eb462
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../lib/db.js";
import DocumentType from "../models/verification/DocumentType.js";
import dns from "dns";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dns.setServers(["1.1.1.1", "8.8.8.8"]);

// ─── Category ObjectIds ───────────────────────────────────────────────────────
const CAT_ELECTRICIAN = new mongoose.Types.ObjectId("6a5d67a6ccd37630b9bfca67");
const CAT_DRIVER      = new mongoose.Types.ObjectId("6a5fcd70a42e2534927a4717");
const CAT_MECHANIC    = new mongoose.Types.ObjectId("6a5fd9d2c5e4dc206c1eb462");

const SEED_DATA = [
  // ── Aadhaar Card (Front + Back) ────────────────────────────────────────────
  // isMultiPage: true — the frontend renders TWO upload slots (front & back).
  // Both slots share this single DocumentType record, differentiated by the
  // `side` field ("front" / "back") on each PartnerDocument record.
  {
    key: "aadhaar_card",
    label: "Aadhaar Card",
    description: "Front and back of your Aadhaar card for identity and address verification.",
    helpText:
      "Upload clear photos of both sides of your Aadhaar card. " +
      "All four corners must be visible and the text must be readable.",
    uploadInstructions:
      "1. Place your Aadhaar card on a flat, well-lit surface.\n" +
      "2. Capture the FRONT side first — your photo, name, and DOB must be visible.\n" +
      "3. Then capture the BACK side — your address must be clearly readable.\n" +
      "4. Avoid shadows, glare, or blurred edges.",
    hasNumberField: true,
    numberFieldLabel: "Aadhaar Number",
    numberFieldPlaceholder: "Enter your 12-digit Aadhaar number",
    numberFieldValidationRegex: "^\\d{12}$",
    numberFieldValidationMessage: "Aadhaar number must be exactly 12 digits.",
    acceptedFileTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
    maxFileSizeMB: 5,
    isMultiPage: true,   // renders front + back upload slots
    isRequired: true,
    icon: "id-card",
    displayOrder: 10,
    visibleToCategories:   [],  // shown to ALL categories
    requiredForCategories: [],  // required for ALL categories
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
    numberFieldValidationMessage:
      "PAN must be in format ABCDE1234F (5 letters, 4 digits, 1 letter).",
    acceptedFileTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
    maxFileSizeMB: 5,
    isMultiPage: false,
    isRequired: false,   // optional globally
    icon: "credit-card",
    displayOrder: 20,
    visibleToCategories:   [],  // shown to ALL categories
    requiredForCategories: [],  // optional for all (isRequired: false handles this)
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
    acceptedFileTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
    maxFileSizeMB: 5,
    isMultiPage: false,
    isRequired: true,
    icon: "camera",
    displayOrder: 30,
    visibleToCategories:   [],  // shown to ALL categories
    requiredForCategories: [],  // required for ALL categories
  },

  // ── Driving License ────────────────────────────────────────────────────────
  // visibleToCategories: [Driver, Mechanic]
  //   → Only partners in these two categories will see this document.
  //   → Electricians and all other categories won't see it at all.
  //
  // requiredForCategories: [Driver]
  //   → Drivers MUST upload it to submit for verification.
  //   → Mechanics see it but it shows as Optional for them.
  {
    key: "driving_license",
    label: "Driving License",
    description: "Valid driving license issued by the RTO.",
    helpText:
      "Upload a clear photo of the front of your driving license. " +
      "Your name, license number, and validity date must be visible.",
    uploadInstructions:
      "1. Place your driving license on a flat surface.\n" +
      "2. Ensure the license number and your name are clearly readable.\n" +
      "3. The validity / expiry date must be visible.\n" +
      "4. Avoid shadows or glare.",
    hasNumberField: true,
    numberFieldLabel: "License Number",
    numberFieldPlaceholder: "E.g. DL-0420110012345",
    numberFieldValidationRegex: "",   // formats vary by state — skip regex
    numberFieldValidationMessage: "",
    acceptedFileTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
    maxFileSizeMB: 5,
    isMultiPage: false,
    isRequired: true,
    icon: "car",
    displayOrder: 40,
    // Visible ONLY to Driver and Mechanic categories
    visibleToCategories: [CAT_DRIVER, CAT_MECHANIC],
    // Required for Drivers. Mechanics see it as Optional (isRequired override).
    requiredForCategories: [CAT_DRIVER],
  },
];

const seed = async () => {
  await connectDB();

  console.log("🌱 Seeding document types...\n");

  let created = 0;
  let updated = 0;

  for (const data of SEED_DATA) {
    const result = await DocumentType.findOneAndUpdate(
      { key: data.key },  // match by key
      { $set: data },     // update all fields
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // Detect create vs update: createdAt ≈ updatedAt on a fresh upsert
    const wasCreated =
      result.createdAt.getTime() === result.updatedAt.getTime() ||
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
