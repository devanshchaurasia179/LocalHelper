import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import Category from "../models/Category.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from Backend directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const categories = [
  {
    name: "Home Service",
    description: "General home maintenance and repair services",
    icon: "hammer-wrench",
    subcategories: [
      { name: "Plumber", description: "Water pipes, fittings, leaks", icon: "pipe-wrench" },
      { name: "Electrician", description: "Wiring, fuse box, appliances", icon: "lightning-bolt" },
      { name: "Carpenter", description: "Furniture, doors, woodwork", icon: "hammer" },
      { name: "Painter", description: "Interior and exterior painting", icon: "format-paint" },
      { name: "Mason", description: "Brickwork, plastering, tiling", icon: "bricks" },
    ],
  },
  {
    name: "Cleaning Service",
    description: "Professional cleaning services for homes and offices",
    icon: "spray-bottle",
    subcategories: [
      { name: "House Cleaning", description: "Deep cleaning for homes", icon: "broom" },
      { name: "Office Cleaning", description: "Commercial cleaning services", icon: "office-building" },
      { name: "Carpet Cleaning", description: "Specialized carpet and upholstery cleaning", icon: "vacuum" },
      { name: "Window Cleaning", description: "Window and glass cleaning", icon: "window-open" },
    ],
  },
  {
    name: "Appliance Service",
    description: "Repair and maintenance of household appliances",
    icon: "washing-machine",
    subcategories: [
      { name: "AC Technician", description: "AC installation, repair, servicing", icon: "air-conditioner" },
      { name: "Refrigerator Repair", description: "Fridge and freezer repair", icon: "fridge-outline" },
      { name: "Washing Machine Repair", description: "Washing machine servicing", icon: "washing-machine" },
      { name: "Microwave Repair", description: "Microwave oven repair", icon: "microwave" },
    ],
  },
  {
    name: "Pest Control",
    description: "Pest elimination and prevention services",
    icon: "bug-outline",
    subcategories: [
      { name: "Termite Control", description: "Termite treatment and prevention", icon: "bug" },
      { name: "Cockroach Control", description: "Cockroach elimination", icon: "bug-outline" },
      { name: "Rodent Control", description: "Rat and mice control", icon: "rodent" },
      { name: "Bed Bug Treatment", description: "Bed bug extermination", icon: "shield-bug-outline" },
    ],
  },
  {
    name: "Beauty & Wellness",
    description: "Personal care and wellness services",
    icon: "face-woman",
    subcategories: [
      { name: "Salon at Home", description: "Hair styling and grooming", icon: "scissors-cutting" },
      { name: "Spa Services", description: "Massage and spa treatments", icon: "spa" },
      { name: "Makeup Artist", description: "Professional makeup services", icon: "lipstick" },
      { name: "Fitness Trainer", description: "Personal fitness training", icon: "dumbbell" },
    ],
  },
];

const seed = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not defined in .env file");
      console.error("Please check that .env file exists in the Backend directory");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to DB");

    console.log("Clearing existing categories...");
    await Category.deleteMany();
    console.log("✅ Cleared");

    console.log("Inserting new categories with subcategories...");
    const inserted = await Category.insertMany(categories);

    console.log("\n✅ Seeded categories with subcategories:");
    console.log("═".repeat(60));
    inserted.forEach((c) => {
      console.log(`\n📁 ${c.name} (ID: ${c._id})`);
      console.log(`   Description: ${c.description}`);
      console.log(`   Subcategories:`);
      c.subcategories.forEach((sub) => {
        console.log(`   ├─ ${sub.name} (ID: ${sub._id})`);
      });
    });
    console.log("\n" + "═".repeat(60));

    await mongoose.disconnect();
    console.log("\n✅ Done. You can now use these IDs in your API requests.");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
};

seed();
