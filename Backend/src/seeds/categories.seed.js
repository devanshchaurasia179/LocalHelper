import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import Category from "../models/Category.js";

dotenv.config();
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const categories = [
  { name: "Plumber",       description: "Water pipes, fittings, leaks" },
  { name: "Electrician",   description: "Wiring, fuse box, appliances" },
  { name: "Carpenter",     description: "Furniture, doors, woodwork" },
  { name: "Painter",       description: "Interior and exterior painting" },
  { name: "Cleaner",       description: "Home and office deep cleaning" },
  { name: "AC Technician", description: "AC installation, repair, servicing" },
  { name: "Mason",         description: "Brickwork, plastering, tiling" },
  { name: "Pest Control",  description: "Termites, cockroaches, rodents" },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    await Category.deleteMany();
    const inserted = await Category.insertMany(categories);

    console.log("Seeded categories:");
    inserted.forEach((c) => console.log(`  ${c.name} → ${c._id}`));

    await mongoose.disconnect();
    console.log("Done.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

seed();
