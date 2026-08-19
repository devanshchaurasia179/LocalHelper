/**
 * One-time script to fix call recordings stuck in "processing" status.
 *
 * If the file is already on Cloudflare R2 but the egress_ended webhook
 * was never received, the recording status stays at "processing" forever.
 * This script marks them as "completed".
 *
 * Usage:
 *   node --experimental-modules src/scripts/fixProcessingRecordings.js
 *
 * Or add to package.json scripts:
 *   "fix:recordings": "node src/scripts/fixProcessingRecordings.js"
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import Call from "../models/call/call.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function fixProcessingRecordings() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Find all calls with recording.status = "processing"
    const stuckCalls = await Call.find({ "recording.status": "processing" });

    console.log(`Found ${stuckCalls.length} call(s) stuck in "processing" status`);

    let fixed = 0;
    for (const call of stuckCalls) {
      // If the call itself is completed (ended) and recording has an objectKey,
      // the file is likely already on R2
      if (call.status === "completed" && call.recording?.objectKey) {
        call.recording.status = "completed";
        call.recording.completedAt = new Date();
        call.recording.error = null;
        await call.save();
        fixed++;
        console.log(`  ✓ Fixed call ${call._id} (room: ${call.roomName})`);
      } else {
        console.log(`  ⊘ Skipped call ${call._id} (call status: ${call.status}, objectKey: ${call.recording?.objectKey || "none"})`);
      }
    }

    console.log(`\nDone. Fixed ${fixed}/${stuckCalls.length} recordings.`);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

fixProcessingRecordings();
