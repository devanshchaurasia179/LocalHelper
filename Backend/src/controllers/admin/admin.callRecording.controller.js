import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Call from "../../models/call/call.js";

// ─── R2 Client singleton ─────────────────────────────────────────────────────

let _s3Client = null;

const getR2Client = () => {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3Client;
};

// ─── GET /api/admin/calls/:callId/recording ──────────────────────────────────

export const getCallRecording = async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await Call.findById(callId)
      .populate("customer", "name phone")
      .populate("partner", "fullName phone")
      .lean();

    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (!call.recording || call.recording.status !== "completed") {
      return res.status(404).json({
        success: false,
        message: "Recording not available",
        recordingStatus: call.recording?.status || "not_started",
      });
    }

    if (!call.recording.objectKey) {
      return res.status(404).json({
        success: false,
        message: "Recording object key not found",
      });
    }

    // Generate a temporary signed URL (expires in 10 minutes)
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: call.recording.objectKey,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 600 });

    return res.status(200).json({
      success: true,
      recording: {
        status: call.recording.status,
        durationSeconds: call.recording.durationSeconds,
        startedAt: call.recording.startedAt,
        completedAt: call.recording.completedAt,
        storageProvider: call.recording.storageProvider,
      },
      call: {
        id: call._id,
        customer: call.customer,
        partner: call.partner,
        roomName: call.roomName,
        callDuration: call.duration,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
      },
      url: signedUrl,
      expiresIn: 600,
    });
  } catch (error) {
    console.error("Get call recording error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get call recording",
    });
  }
};

// ─── POST /api/admin/calls/:callId/recording/force-complete ──────────────────
// Checks if the file exists in R2 and marks recording as completed.
// Use this to fix stuck "processing" recordings where the webhook didn't fire.

export const forceCompleteRecording = async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (call.recording?.status === "completed") {
      return res.status(200).json({
        success: true,
        message: "Recording is already completed",
      });
    }

    if (!call.recording?.objectKey) {
      return res.status(400).json({
        success: false,
        message: "No recording object key found — recording may not have started",
      });
    }

    // Check if the file actually exists in R2
    const client = getR2Client();
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: call.recording.objectKey,
        })
      );
    } catch (headError) {
      if (headError.name === "NotFound" || headError.$metadata?.httpStatusCode === 404) {
        return res.status(404).json({
          success: false,
          message: "Recording file not found in R2 — egress may not have uploaded yet",
        });
      }
      throw headError;
    }

    // File exists — mark as completed
    call.recording.status = "completed";
    call.recording.completedAt = new Date();
    call.recording.error = null;
    await call.save();

    console.log(`[ADMIN] Force-completed recording for call ${callId}`);

    return res.status(200).json({
      success: true,
      message: "Recording marked as completed",
      objectKey: call.recording.objectKey,
    });
  } catch (error) {
    console.error("Force complete recording error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to force-complete recording",
    });
  }
};
