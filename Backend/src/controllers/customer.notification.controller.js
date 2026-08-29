import Customer from "../models/customer/Customer.js";

// ─── Validation helper ───────────────────────────────────────────────────────
/** Validate the { token, platform } body. Returns an error message or null. */
const validateTokenBody = (token, platform) => {
  if (typeof token !== "string" || token.trim().length === 0) {
    return "token is required and must be a non-empty string.";
  }
  if (platform !== "android" && platform !== "ios") {
    return "platform must be either 'android' or 'ios'.";
  }
  return null;
};

// ─── Register FCM Token ───────────────────────────────────────────────────────
/**
 * POST /api/customer/fcm-token
 * Headers: Cookie customer_token=<jwt>
 * Body: { token, platform }
 *
 * Upserts the device token so push notifications can be delivered.
 */
export const registerFcmToken = async (req, res) => {
  try {
    const { token, platform } = req.body;

    const validationError = validateTokenBody(token, platform);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    customer.addFcmToken(token.trim(), platform);
    await customer.save();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("registerFcmToken error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── Unregister FCM Token ─────────────────────────────────────────────────────
/**
 * DELETE /api/customer/fcm-token
 * Headers: Cookie customer_token=<jwt>
 * Body: { token, platform }
 *
 * Removes the device token so this device stops receiving push notifications.
 */
export const unregisterFcmToken = async (req, res) => {
  try {
    const { token, platform } = req.body;

    const validationError = validateTokenBody(token, platform);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    customer.removeFcmToken(token.trim());
    await customer.save();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("unregisterFcmToken error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
