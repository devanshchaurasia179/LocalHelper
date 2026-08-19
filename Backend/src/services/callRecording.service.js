import { LiveKitAPI, EncodedFileOutput, EncodedFileType } from "livekit-server-sdk";
import Call from "../models/call/call.js";

// ─── LiveKit API singleton ───────────────────────────────────────────────────

let _livekitApi = null;

const getLiveKitAPI = () => {
  if (!_livekitApi) {
    _livekitApi = new LiveKitAPI({
      host: process.env.LIVEKIT_URL,
      apiKey: process.env.LIVEKIT_API_KEY,
      secret: process.env.LIVEKIT_API_SECRET,
    });
  }
  return _livekitApi;
};

// ─── S3 upload config for Cloudflare R2 ──────────────────────────────────────

const buildR2Output = (objectKey) => {
  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: objectKey,
    output: {
      case: "s3",
      value: {
        accessKey: process.env.R2_ACCESS_KEY_ID,
        secret: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET_NAME,
        endpoint: process.env.R2_ENDPOINT,
        forcePathStyle: true,
        region: "auto",
      },
    },
  });
};

// ─── Build deterministic object key ──────────────────────────────────────────

const buildObjectKey = (callId) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `calls/${year}/${month}/${callId}.mp4`;
};

// ─── Start Call Recording ────────────────────────────────────────────────────

export const startCallRecording = async (call) => {
  try {
    // Idempotency: don't start if already recording or has an egressId
    if (
      call.recording?.egressId ||
      ["starting", "recording", "processing"].includes(call.recording?.status)
    ) {
      console.log(
        `[CALL RECORDING] Skipped — already active for call ${call._id}`
      );
      return;
    }

    const objectKey = buildObjectKey(call._id.toString());

    // Mark as starting
    call.recording = {
      ...call.recording,
      status: "starting",
      objectKey,
      storageProvider: "r2",
      startedAt: new Date(),
    };
    await call.save();

    console.log(`[CALL RECORDING] Starting for room: ${call.roomName}`);

    const api = getLiveKitAPI();

    const fileOutput = buildR2Output(objectKey);

    const egressInfo = await api.egress.startRoomCompositeEgress(
      call.roomName,
      { file: fileOutput },
      { audioOnly: true }
    );

    // Update call with egressId
    call.recording.egressId = egressInfo.egressId;
    call.recording.status = "recording";
    await call.save();

    console.log(`[CALL RECORDING] Egress started`);
    console.log(`[CALL RECORDING] Egress ID: ${egressInfo.egressId}`);
    console.log(`[CALL RECORDING] R2 object: ${objectKey}`);
  } catch (error) {
    console.error(`[CALL RECORDING] Failed to start:`, error.message);

    // Don't let recording failure break the call
    try {
      call.recording = {
        ...call.recording,
        status: "failed",
        error: error.message,
      };
      await call.save();
    } catch (saveError) {
      console.error("[CALL RECORDING] Failed to save error state:", saveError.message);
    }
  }
};

// ─── Stop Call Recording ─────────────────────────────────────────────────────

export const stopCallRecording = async (call) => {
  try {
    const egressId = call.recording?.egressId;

    if (!egressId) {
      console.log(`[CALL RECORDING] No egressId for call ${call._id} — skipping stop`);
      return;
    }

    // If already completed or failed, no-op
    if (["completed", "failed"].includes(call.recording?.status)) {
      console.log(`[CALL RECORDING] Already ${call.recording.status} — skipping`);
      return;
    }

    console.log(`[CALL RECORDING] Stopping egress: ${egressId}`);

    const api = getLiveKitAPI();

    call.recording.status = "processing";
    await call.save();

    await api.egress.stopEgress(egressId);

    console.log(`[CALL RECORDING] Stop requested for egress: ${egressId}`);
    // Final status will be updated by webhook when egress completes upload to R2
  } catch (error) {
    console.error(`[CALL RECORDING] Failed to stop:`, error.message);

    // Handle "egress not found" or "egress already ended" gracefully
    if (
      error.message?.includes("not found") ||
      error.message?.includes("not active")
    ) {
      console.log("[CALL RECORDING] Egress already ended — marking as completed");
      call.recording.status = "completed";
      call.recording.completedAt = new Date();
      await call.save();
      return;
    }

    try {
      call.recording.status = "failed";
      call.recording.error = error.message;
      await call.save();
    } catch (saveError) {
      console.error("[CALL RECORDING] Failed to save error state:", saveError.message);
    }
  }
};

// ─── Handle Egress Completion (called from webhook) ──────────────────────────

export const handleEgressCompleted = async (egressInfo) => {
  try {
    const egressId = egressInfo.egressId;
    console.log(`[CALL RECORDING] Completed — Egress ID: ${egressId}`);

    const call = await Call.findOne({ "recording.egressId": egressId });

    if (!call) {
      console.warn(`[CALL RECORDING] No call found for egress ${egressId}`);
      return;
    }

    // Extract duration from file results if available
    // SDK v2 may use fileResults, file_results, or file (for single file output)
    let durationSeconds = null;
    const fileResults = egressInfo.fileResults || egressInfo.file_results || [];
    const fileInfo = egressInfo.file || egressInfo.fileInfo;

    if (fileResults.length > 0) {
      const fileResult = fileResults[0];
      const dur = fileResult.duration || fileResult.durationNs;
      if (dur) {
        // Duration from LiveKit is in nanoseconds
        durationSeconds = Math.round(Number(dur) / 1_000_000_000);
      }
    } else if (fileInfo) {
      const dur = fileInfo.duration || fileInfo.durationNs;
      if (dur) {
        durationSeconds = Math.round(Number(dur) / 1_000_000_000);
      }
    }

    call.recording.status = "completed";
    call.recording.completedAt = new Date();
    if (durationSeconds) {
      call.recording.durationSeconds = durationSeconds;
    }
    call.recording.error = null;
    await call.save();

    console.log(`[CALL RECORDING] Completed for call ${call._id}`);
    console.log(`[CALL RECORDING] R2 object: ${call.recording.objectKey}`);
    if (durationSeconds) {
      console.log(`[CALL RECORDING] Duration: ${durationSeconds}s`);
    }
  } catch (error) {
    console.error("[CALL RECORDING] Error handling completion:", error.message);
  }
};

// ─── Handle Egress Failure (called from webhook) ─────────────────────────────

export const handleEgressFailed = async (egressInfo) => {
  try {
    const egressId = egressInfo.egressId;
    console.error(`[CALL RECORDING] Failed — Egress ID: ${egressId}`);

    const call = await Call.findOne({ "recording.egressId": egressId });

    if (!call) {
      console.warn(`[CALL RECORDING] No call found for egress ${egressId}`);
      return;
    }

    call.recording.status = "failed";
    call.recording.error = egressInfo.error || "Egress failed";
    await call.save();

    console.error(`[CALL RECORDING] Failed for call ${call._id}: ${egressInfo.error}`);
  } catch (error) {
    console.error("[CALL RECORDING] Error handling failure:", error.message);
  }
};
