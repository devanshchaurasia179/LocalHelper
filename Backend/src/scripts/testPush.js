/**
 * One-off script to test FCM push delivery to a specific user's device tokens.
 *
 * It loads the user (partner or customer) from the DB, reads their fcmTokens,
 * sends a REAL notification through Firebase using the SAME message shape as a
 * booking notification, and prints the full per-token success/failure response.
 * Any hidden FCM error code (stale token, credential mismatch, etc.) surfaces
 * here instead of being swallowed by notification.service.js.
 *
 * Usage (from the Backend folder):
 *   node src/scripts/testPush.js partner <partnerId>
 *   node src/scripts/testPush.js customer <customerId>
 *
 * Example:
 *   node src/scripts/testPush.js partner 665f1a2b3c4d5e6f7a8b9c0d
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";

// Use public DNS resolvers (same as server.js) so Atlas SRV records resolve.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Import AFTER dotenv.config so firebase.js sees the credentials env var.
const { initFirebase, getMessaging, isFirebaseInitialized } = await import(
  "../config/firebase.js"
);
const Customer = (await import("../models/customer/Customer.js")).default;
const Partner = (await import("../models/partner/Partner.js")).default;

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function main() {
  const [, , userType, userId] = process.argv;

  if (!userType || !userId || !["partner", "customer"].includes(userType)) {
    console.error(
      "Usage: node src/scripts/testPush.js <partner|customer> <userId>"
    );
    process.exit(1);
  }

  // 1. Firebase must be initialized (credentials present + valid).
  initFirebase();
  if (!isFirebaseInitialized()) {
    console.error(
      "[testPush] Firebase is NOT initialized. Check FIREBASE_SERVICE_ACCOUNT_JSON / _PATH in .env."
    );
    process.exit(1);
  }
  console.log("[testPush] Firebase initialized OK.");

  // 2. Connect to Mongo and load the user's tokens.
  await mongoose.connect(MONGO_URI);
  console.log("[testPush] Connected to MongoDB.");

  const Model = userType === "partner" ? Partner : Customer;
  const user = await Model.findById(userId).select("fcmTokens");

  if (!user) {
    console.error(`[testPush] ${userType} ${userId} not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const tokens = (user.fcmTokens || [])
    .map((t) => t.token)
    .filter((t) => typeof t === "string" && t.length > 0);

  console.log(`[testPush] Found ${tokens.length} token(s) for this ${userType}.`);
  tokens.forEach((t, i) =>
    console.log(`   [${i}] ${t.slice(0, 24)}...${t.slice(-12)} (len ${t.length})`)
  );

  if (tokens.length === 0) {
    console.error("[testPush] No tokens to send to. Nothing to test.");
    await mongoose.disconnect();
    process.exit(1);
  }

  // 3. Send the SAME message shape a booking notification uses:
  //    a visible notification block + a data payload with type "booking".
  const message = {
    tokens,
    notification: {
      title: "Test push",
      body: "If you can see this, FCM delivery works.",
    },
    data: {
      type: "booking",
      action: "test",
      bookingId: "test-booking-id",
    },
    android: { priority: "high" },
  };

  console.log("[testPush] Sending multicast...");
  const response = await getMessaging().sendEachForMulticast(message);

  console.log(
    `[testPush] Result: successCount=${response.successCount}, failureCount=${response.failureCount}`
  );

  // 4. Print the full per-token outcome, including the FCM error code.
  response.responses.forEach((res, idx) => {
    if (res.success) {
      console.log(`   [${idx}] OK   messageId=${res.messageId}`);
    } else {
      console.log(
        `   [${idx}] FAIL code=${res.error?.code || "unknown"} msg=${
          res.error?.message || res.error
        }`
      );
    }
  });

  await mongoose.disconnect();
  console.log("[testPush] Done.");
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[testPush] Fatal error:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
