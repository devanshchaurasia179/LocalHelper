import { getMessaging, isFirebaseInitialized } from "../config/firebase.js";
import Customer from "../models/customer/Customer.js";
import Partner from "../models/partner/Partner.js";

/**
 * Push Notification Service
 *
 * Thin wrapper around Firebase Cloud Messaging (FCM) that:
 *   - Loads the target user's registered device tokens
 *   - Builds either a DATA-ONLY high-priority message (for calls) or a
 *     standard notification message
 *   - Multicasts to every token the user has
 *   - Prunes tokens FCM reports as unregistered / invalid
 *
 * Everything is wrapped so a delivery failure only logs — it never throws
 * back into the caller (booking flow, call flow, etc. must not break because
 * a push failed).
 */

// FCM message types that represent a VoIP-style call event. These are sent as
// data-only, high-priority messages so the client can wake up and render its
// own full-screen call UI instead of a passive notification.
const CALL_TYPES = new Set(["incoming_call", "call_cancel"]);

// FCM error codes that mean the token is dead and should be removed.
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
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

    if (tokens.length === 0) {
      // Nothing to send to — not an error, just no devices registered.
      return;
    }

    // Always merge the type into the data payload (as a string) so the client
    // can branch on it regardless of message shape.
    const payloadData = stringifyData({ ...data, ...(type ? { type } : {}) });

    const isCall = type && CALL_TYPES.has(type);

    // Build the message. Call events are DATA-ONLY + high priority so the app
    // can wake and render its own full-screen call UI. Everything else carries
    // a visible notification block alongside the data.
    const message = { tokens, data: payloadData };

    if (isCall) {
      message.android = { priority: "high" };
    } else {
      message.notification = {
        title: notification?.title ?? "",
        body: notification?.body ?? "",
      };
    }

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message);

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
