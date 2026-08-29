import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import Partner from "../models/partner/Partner.js";
import Category from "../models/Category.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from Backend directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dns.setServers(["1.1.1.1", "8.8.8.8"]);

// Base location — all partners are placed at this exact point.
const BASE_LNG = 74.8899823;
const BASE_LAT = 31.6560027;

// Profile photos (Cloudinary demo faces from randomuser-style placeholders)
const photo = (n) => `https://randomuser.me/api/portraits/${n % 2 === 0 ? "men" : "women"}/${(n % 90) + 1}.jpg`;

const LANGUAGE_SETS = [
  ["Hindi", "English", "Punjabi"],
  ["Hindi", "Punjabi"],
  ["Hindi", "English"],
  ["Punjabi", "English"],
  ["Hindi"],
];

const NAMES = [
  "Rajesh Kumar", "Simran Kaur", "Amit Sharma", "Priya Verma", "Harpreet Singh",
  "Neha Gupta", "Vikram Chauhan", "Anjali Rana", "Manpreet Gill", "Sunita Devi",
  "Rohit Malhotra", "Kavita Joshi", "Deepak Yadav", "Pooja Bansal", "Sandeep Arora",
  "Ritu Saini", "Gurpreet Kaur", "Naveen Thakur", "Meena Kumari", "Aakash Mehta",
];

// Build partner definitions from real categories/subcategories loaded from DB.
function buildPartners(categories) {
  const partners = [];
  let idx = 0;

  // For each category, create a few partners spread across its subcategories.
  categories.forEach((cat) => {
    const activeSubs = cat.subcategories.filter((s) => s.isActive !== false);
    if (activeSubs.length === 0) return;

    // 3 partners per category
    for (let k = 0; k < 3; k++) {
      const sub = activeSubs[k % activeSubs.length];
      const name = NAMES[idx % NAMES.length];

      partners.push({
        phone: `90000${String(10000 + idx).slice(-5)}`,
        fullName: name,
        gender: idx % 2 === 0 ? "Male" : "Female",
        dateOfBirth: new Date(1990 + (idx % 12), idx % 12, (idx % 27) + 1),
        profilePhoto: photo(idx),

        verification: { phoneVerified: true, identityVerified: true },
        isProfile: true,
        isService: true,
        isDocument: true,
        verificationStatus: "Approved",
        accountStatus: "Active",
        isDeleted: false,

        address: {
          house: `${100 + idx}`,
          street: `Street ${idx + 1}`,
          locality: "Model Town",
          city: "Jalandhar",
          state: "Punjab",
          pincode: "144001",
        },

        serviceLocation: {
          type: "Point",
          coordinates: [BASE_LNG, BASE_LAT],
        },
        serviceRadius: 10 + (idx % 3) * 5, // 10, 15, 20 km

        categories: [cat._id],
        subcategories: [{ categoryId: cat._id, subcategoryId: sub._id }],

        experience: 1 + (idx % 15),
        languages: LANGUAGE_SETS[idx % LANGUAGE_SETS.length],
        bio: `Experienced ${sub.name} serving ${cat.name.toLowerCase()} needs across Jalandhar.`,

        visitingCredits: {
          type: "perVisit",
          amount: 200 + (idx % 6) * 100, // 200–700
        },
        chatCharges: (idx % 3) * 5, // 0, 5, 10
        callCharges: {
          amount: 10 + (idx % 4) * 5, // 10–25
          durationMinutes: 10,
        },

        isOnline: idx % 3 !== 0,
        isAvailable: true,

        averageRating: Number((3.5 + (idx % 5) * 0.3).toFixed(1)), // 3.5–4.7
        totalReviews: 5 + idx * 3,
        completedJobs: 10 + idx * 4,
        cancelledJobs: idx % 4,

        walletBalance: 0,
        totalEarnings: (10 + idx * 4) * 300,
      });

      idx++;
    }
  });

  return partners;
}

const seed = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not defined in .env file");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to DB");

    const categories = await Category.find({ isActive: { $ne: false } }).lean();
    if (categories.length === 0) {
      console.error("❌ No categories found. Run the categories seed first.");
      process.exit(1);
    }
    console.log(`Found ${categories.length} categories.`);

    const partners = buildPartners(categories);

    // Remove any previously seeded demo partners (phones starting 90000)
    console.log("Clearing previously seeded demo partners...");
    const del = await Partner.deleteMany({ phone: { $regex: /^90000/ } });
    console.log(`✅ Removed ${del.deletedCount} old demo partners`);

    console.log(`Inserting ${partners.length} demo partners...`);
    const inserted = await Partner.insertMany(partners);

    console.log("\n✅ Seeded partners:");
    console.log("═".repeat(70));
    inserted.forEach((p) => {
      const [lng, lat] = p.serviceLocation.coordinates;
      console.log(
        `👤 ${p.fullName.padEnd(18)} | ${p.phone} | radius ${p.serviceRadius}km | ` +
          `[${lng.toFixed(4)}, ${lat.toFixed(4)}] | ⭐ ${p.averageRating}`
      );
    });
    console.log("═".repeat(70));
    console.log(`\nBase location used: [${BASE_LNG}, ${BASE_LAT}] (Jalandhar)`);
    console.log("Query nearby with a customer location near this point to see them.");

    await mongoose.disconnect();
    console.log("\n✅ Done.");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
};

seed();
