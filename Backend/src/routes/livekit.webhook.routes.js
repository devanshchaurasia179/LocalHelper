import { Router } from "express";
import { handleLiveKitWebhook } from "../controllers/livekit.webhook.controller.js";

const router = Router();

// LiveKit sends the webhook body as raw text with content-type application/webhook+json
// We need the raw body for signature verification, so this route uses express.raw()
router.post(
  "/",
  // Override the global JSON parser — we need raw body for signature verification
  (req, res, next) => {
    // If body is already a string (from express.text()), pass through
    if (typeof req.body === "string") {
      return next();
    }
    // If body is a Buffer, convert to string
    if (Buffer.isBuffer(req.body)) {
      req.body = req.body.toString("utf-8");
      return next();
    }
    // If body was parsed as JSON by express.json(), stringify it back
    if (typeof req.body === "object") {
      req.body = JSON.stringify(req.body);
      return next();
    }
    next();
  },
  handleLiveKitWebhook
);

export default router;
