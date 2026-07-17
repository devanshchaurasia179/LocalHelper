/**
 * Admin Seed Script
 *
 * Creates the initial SUPER_ADMIN account.
 * Run once: node src/seeds/admin.seed.js
 *
 * The pre-save hook on the Admin model will auto-hash the password
 * before it reaches MongoDB, so we pass the plain password here.
 */
import dns from "dns";
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../lib/db.js";
import Admin from "../models/admin/Admin.js";
// Change DNS
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const seedAdmin = async () => {
  await connectDB();

  // Prevent duplicate seed runs
  const existing = await Admin.findOne({ email: "admin@gmail.com" });
  if (existing) {
    console.log("⚠️  Seed skipped: admin@gmail.com already exists.");
    process.exit(0);
  }

  // The pre-save hook will hash this password automatically.
  // Plain password only lives here in memory — never reaches DB unhashed.
  await Admin.create({
    name: "Super Admin",
    email: "admin@gmail.com",
    password: "admin@1721",   // will be bcrypt-hashed by pre-save hook
    role: "SUPER_ADMIN",
    isActive: true,
  });

  console.log("✅ SUPER_ADMIN created: admin@gmail.com");
  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
