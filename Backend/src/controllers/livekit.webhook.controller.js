import { WebhookReceiver } from "livekit-server-sdk";
import {
  handleEgressCompleted,
  handleEgressFailed,
} from "../services/callRecording.service.js";

// ─── Webhook Receiver singleton ──────────────────────────────────────────────

let _receiver = null;

const getWebhookReceiver = () => {
  if (!_receiver) {
    _receiver = new WebhookReceiver(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );
  }
  return _receiver;
};

// ─── Helper: check if egress status indicates completion ─────────────────────

/**
 * LiveKit SDK v2 can return status as:
 *   - Numeric: 3 (EGRESS_COMPLETE), 4 (EGRESS_FAILED), 5 (EGRESS_ABORTED)
 *   - String enum: "EGRESS_COMPLETE", "EGRESS_FAILED", "EGRESS_ABORTED"
 *   - Or the proto field name in some SDK versions
 * We handle all cases to be safe.
 */
const isEgressComplete = (status) => {
  if (status === 3) return true;
  if (typeof status === "string") {
    const s = status.toUpperCase();
    return s === "EGRESS_COMPLETE" || s === "EGRESS_ENDING" || s === "3";
  }
  return false;
};

const isEgressFailed = (status) => {
  if (status === 4 || status === 5) return true;
  if (typeof status === "string") {
    const s = status.toUpperCase();
    return s === "EGRESS_FAILED" || s === "EGRESS_ABORTED" || s === "4" || s === "5";
  }
  return false;
};

// ─── LiveKit Webhook Endpoint ────────────────────────────────────────────────

export const handleLiveKitWebhook = async (req, res) => {
  try {
    const receiver = getWebhookReceiver();

    // The webhook body must be the raw string for signature verification
    const body = req.body;
    const authHeader = req.get("Authorization");

    if (!authHeader) {
      return res.status(401).json({ message: "Missing Authorization header" });
    }

    // Verify and decode the webhook event
    const event = await receiver.receive(body, authHeader);

    console.log(`[LIVEKIT WEBHOOK] Event: ${event.event}`);
    console.log(`[LIVEKIT WEBHOOK] Full event payload:`, JSON.stringify(event, null, 2));

    switch (event.event) {
      case "egress_ended": {
        const egressInfo = event.egressInfo;
        if (!egressInfo) {
          console.warn("[LIVEKIT WEBHOOK] egress_ended but no egressInfo present");
          break;
        }

        const status = egressInfo.status;
        console.log(`[LIVEKIT WEBHOOK] Egress ID: ${egressInfo.egressId}, Status: ${status} (type: ${typeof status})`);
        console.log(`[LIVEKIT WEBHOOK] File results:`, JSON.stringify(egressInfo.fileResults || egressInfo.file_results || [], null, 2));

        if (isEgressComplete(status)) {
          console.log("[LIVEKIT WEBHOOK] → Handling as COMPLETED");
          await handleEgressCompleted(egressInfo);
        } else if (isEgressFailed(status)) {
          console.log("[LIVEKIT WEBHOOK] → Handling as FAILED");
          await handleEgressFailed(egressInfo);
        } else {
          console.warn(`[LIVEKIT WEBHOOK] Unknown egress status: ${status} — attempting completion handler`);
          // If status is unknown but we got an egress_ended event, try to handle as complete
          // since LiveKit only sends egress_ended when egress is truly done
          await handleEgressCompleted(egressInfo);
        }
        break;
      }

      case "egress_started": {
        console.log(
          `[LIVEKIT WEBHOOK] Egress started: ${event.egressInfo?.egressId}`
        );
        break;
      }

      default:
        // Other events (room_started, participant_joined, etc.) — ignore
        console.log(`[LIVEKIT WEBHOOK] Ignoring event: ${event.event}`);
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[LIVEKIT WEBHOOK] Error processing webhook:", error.message);
    console.error("[LIVEKIT WEBHOOK] Stack:", error.stack);
    // Return 200 to avoid LiveKit retrying on validation errors during dev
    return res.status(200).json({ received: true, error: error.message });
  }
};
