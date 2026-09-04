import { getMessaging, isFirebaseInitialized } from "../config/firebase.js";
import Customer from "../models/customer/Customer.js";
import Partner from "../models/partner/Partner.js";

/**
 * Push Notification Service
 *
 * Thin wrapper around Firebase Cloud Messaging (FCM) that:
 *   - Loads the target user's registered device tokens
 *   - Builds the appropriate FCM message for the event type
 *   - Multicasts to every token the user has
 *   - Prunes tokens FCM reports as unregistered / invalid
 *
 * Everything is wrapped so a delivery failure only logs — it never throws
 * back into the caller (booking flow, call flow, etc. must not break because
 * a push failed).
 *
 * CALL DELIVERY STRATEGY
 * ──────────────────────
 * incoming_call uses a NOTIFICATION message (not data-only) so that FCM's
 * high-priority delivery path bypasses Android Doze / App Standby and wakes
 * the device even when the app is completely killed. A data-only message with
 * priority:"high" is still subject to deferral on many OEM ROMs once the
 * app has been force-stopped or Doze deep-sleep has been entered.
 *
 * The notification title/body are set to visually meaningful strings so the
 * system tray shows a useful alert while the app is cold-starting.  The full
 * call payload is still delivered in the `data` map so the JS background
 * handler can read callId / roomName / callerName and display the custom
 * Notifee UI once the engine wakes.
 *
 * call_cancel is data-only (priority:"high") because it only needs to dismiss
 * a notification — it doesn't need to wake the device from deep sleep.
 */

// call_cancel is the only call-adjacent type that stays data-only.
const DATA_ONLY_CALL_TYPES = new Set(["call_cancel"]);

// FCM error codes that mean the token is dead/unusable and should be removed.
// invalid-argument covers malformed or junk tokens (e.g. leftover test values)
// that FCM rejects outright — pruning them stops them failing on every send.
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/** Resolve the Mongoose model for a given user type. */
const getModel = (userType) => {
  if (userType === "customer") return Customer;
  if (userType === "partner") return Partner;
  return null;
};

/**
 * Coerce every value in a data payload to a string.
 * FCM rejects the whole message if any data value is not a string.
 */
const stringifyData = (data = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] =
      typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
};

/**
 * sendToUser({ userType, userId, notification, data, type })
 *
 * @param {object}  params
 * @param {'customer'|'partner'} params.userType  Which collection the user lives in
 * @param {string}  params.userId       The user's _id
 * @param {object}  [params.notification]  { title, body } — used for non-call messages
 * @param {object}  [params.data]          Arbitrary key/value payload (coerced to strings)
 * @param {string}  [params.type]          Message type; call types are sent data-only
 * @returns {Promise<void>}  Never throws — logs and returns on any failure.
 */
export const sendToUser = async ({ userType, userId, notification, data = {}, type } = {}) => {
  try {
    console.log(`[notification] sendToUser → userType=${userType} userId=${userId} type=${type}`);

    if (!isFirebaseInitialized()) {
      console.error("[notification] Firebase not initialized — skipping push.");
      return;
    }

    const Model = getModel(userType);
    if (!Model) {
      console.error(`[notification] Unknown userType "${userType}".`);
      return;
    }

    const user = await Model.findById(userId).select("fcmTokens");
    if (!user) {
      console.error(`[notification] ${userType} ${userId} not found.`);
      return;
    }

    const tokens = (user.fcmTokens || [])
      .map((t) => t.token)
      .filter((t) => typeof t === "string" && t.length > 0);

    console.log(`[notification] ${userType} ${userId} has ${tokens.length} token(s).`);

    if (tokens.length === 0) {
      // Nothing to send to — not an error, just no devices registered.
      console.warn(`[notification] No FCM tokens for ${userType} ${userId} — push skipped.`);
      return;
    }

    // Always merge the type into the data payload (as a string) so the client
    // can branch on it regardless of message shape.
    const payloadData = stringifyData({ ...data, ...(type ? { type } : {}) });

    const isIncomingCall = type === "incoming_call";
    const isMissedCall   = type === "missed_call";
    const isDataOnlyCall = type && DATA_ONLY_CALL_TYPES.has(type);

    // Build the FCM message.
    //
    // incoming_call: notification message + data payload + high priority.
    //   The `notification` block guarantees FCM delivers the message even when
    //   the app is killed and the device is in Doze. The `data` block carries
    //   the full call payload for the JS background handler.
    //
    // call_cancel: data-only + high priority — only needs to dismiss the
    //   call notification, no need to wake from deep sleep.
    //
    // Everything else: notification message + data payload + high priority +
    //   notification.priority "max" so Android shows a heads-up banner for
    //   bookings, chat, missed calls etc. even when the screen is off.
    const message = { tokens, data: payloadData };

    if (isIncomingCall) {
      const callerName = data?.callerName ?? "Customer";
      message.notification = {
        title: "Incoming Call",
        body: `${callerName} is calling you`,
      };
      message.android = {
        priority: "high",
        notification: {
          // Map to the same channel the partner app creates for call alerts.
          channelId: "incoming_calls_v2",
          sound: "ringtone",
          vibrateTimingsMillis: [300, 500, 300, 500],
          priority: "max",
        },
      };
    } else if (isMissedCall) {
      message.notification = {
        title: notification?.title ?? "Missed Call",
        body:  notification?.body  ?? "You missed a call",
      };
      message.android = {
        priority: "high",
        notification: {
          channelId: "missed_calls",
          priority:  "max",
          vibrateTimingsMillis: [200, 300],
        },
      };
    } else if (isDataOnlyCall) {
      message.android = { priority: "high" };
    } else {
      message.notification = {
        title: notification?.title ?? "",
        body: notification?.body ?? "",
      };
      message.android = {
        priority: "high",
        notification: {
          priority: "max",
        },
      };
    }

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[notification] sendEachForMulticast → success=${response.successCount} fail=${response.failureCount}`);

    // Prune any tokens FCM reports as dead so we stop targeting them.
    if (response.failureCount > 0) {
      const deadTokens = [];
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const code = res.error?.code;
          if (DEAD_TOKEN_CODES.has(code)) {
            deadTokens.push(tokens[idx]);
          } else {
            console.error(
              `[notification] Send failed for a token (${code || "unknown"}):`,
              res.error?.message || res.error
            );
          }
        }
      });

      if (deadTokens.length > 0) {
        try {
          for (const dead of deadTokens) {
            user.removeFcmToken(dead);
          }
          await user.save();
        } catch (pruneError) {
          console.error("[notification] Failed to prune dead tokens:", pruneError);
        }
      }
    }
  } catch (error) {
    console.error("[notification] sendToUser error:", error?.message || error);
  }
};

export default { sendToUser };
