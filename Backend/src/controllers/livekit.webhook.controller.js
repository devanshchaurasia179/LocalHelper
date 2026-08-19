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

    switch (event.event) {
      case "egress_ended": {
        const egressInfo = event.egressInfo;
        if (!egressInfo) break;

        // EgressStatus: 3 = EGRESS_COMPLETE, 4 = EGRESS_FAILED, 5 = EGRESS_ABORTED
        const status = egressInfo.status;

        if (status === 3) {
          // EGRESS_COMPLETE
          await handleEgressCompleted(egressInfo);
        } else if (status === 4 || status === 5) {
          // EGRESS_FAILED or EGRESS_ABORTED
          await handleEgressFailed(egressInfo);
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
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[LIVEKIT WEBHOOK] Error processing webhook:", error.message);
    // Return 200 to avoid LiveKit retrying on validation errors during dev
    return res.status(200).json({ received: true, error: error.message });
  }
};
