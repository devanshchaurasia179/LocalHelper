/**
 * One-off script to remove invalid / junk FCM tokens from all users.
 *
 * Real FCM registration tokens are ~140+ characters and contain a ":". Leftover
 * test values like "token-partner" / "token-customer" are short and cause
 * every push send to fail with messaging/invalid-argument, which (before the
 * pruning fix) never got cleaned up. This script strips anything that can't be
 * a valid token.
 *
 * Usage (from the Backend folder):
 *   node src/scripts/cleanFcmTokens.js          # dry run — reports only
 *   node src/scripts/cleanFcmTokens.js --apply  # actually removes them
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const Customer = (await import("../models/customer/Customer.js")).default;
const Partner = (await import("../models/partner/Partner.js")).default;

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// A real FCM token is long and contains a colon separating the instance id
// from the token body. Anything shorter/simpler is junk.
const isProbablyValidToken = (token) =>
  typeof token === "string" && token.length >= 100 && token.includes(":");

async function cleanModel(Model, label, apply) {
  const users = await Model.find({ "fcmTokens.0": { $exists: true } }).select(
    "fcmTokens"
  );

  let usersTouched = 0;
  let tokensRemoved = 0;

  for (const user of users) {
    const before = user.fcmTokens.length;
    const kept = user.fcmTokens.filter((t) => isProbablyValidToken(t.token));
    const removed = before - kept.length;

    if (removed > 0) {
      usersTouched++;
      tokensRemoved += removed;
      const badValues = user.fcmTokens
        .filter((t) => !isProbablyValidToken(t.token))
        .map((t) => JSON.stringify(t.token));
      console.log(
        `  ${label} ${user._id}: removing ${removed} junk token(s): ${badValues.join(", ")}`
      );

      if (apply) {
        user.fcmTokens = kept;
        await user.save();
      }
    }
  }

  console.log(
    `[cleanFcmTokens] ${label}: ${usersTouched} user(s) affected, ${tokensRemoved} token(s) ${
      apply ? "removed" : "would be removed"
    }.`
  );
}

async function main() {
  const apply = process.argv.includes("--apply");

  await mongoose.connect(MONGO_URI);
  console.log(
    `[cleanFcmTokens] Connected to MongoDB. Mode: ${apply ? "APPLY" : "DRY RUN"}`
  );

  await cleanModel(Partner, "partner", apply);
  await cleanModel(Customer, "customer", apply);

  await mongoose.disconnect();
  console.log(
    `[cleanFcmTokens] Done.${apply ? "" : " Re-run with --apply to actually remove."}`
  );
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[cleanFcmTokens] Fatal error:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
