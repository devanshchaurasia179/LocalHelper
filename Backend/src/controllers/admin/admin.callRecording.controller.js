import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
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
