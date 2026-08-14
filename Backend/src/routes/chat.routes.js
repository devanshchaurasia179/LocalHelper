import express from "express";
import jwt from "jsonwebtoken";
import { upload } from "../middleware/upload.middleware.js";
import {
  getOrCreateConversation,
  getMyConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  deleteConversation,
  markConversationRead,
} from "../controllers/chat.controller.js";

// ── Auth middleware imports ────────────────────────────────────────────────────
import protectCustomer from "../middleware/customer.auth.middleware.js";
import protectPartner  from "../middleware/partner.auth.middleware.js";

/**
 * flexAuth — allows either a customer or a partner to call the same endpoint.
 *
 * Tries the customer token first (synchronous JWT check).
 * If the customer cookie is absent, falls through to the partner check.
 * If neither token is present the request is rejected.
 */
const flexAuth = (req, res, next) => {
  const customerToken = req.cookies?.customer_token;
  const partnerToken  = req.cookies?.partner_token;

  if (customerToken) {
    return protectCustomer(req, res, next);
  }
  if (partnerToken) {
    return protectPartner(req, res, next);
  }
  return res.status(401).json({ message: "Unauthorised. Please log in." });
};

const router = express.Router();

// ── Socket token ──────────────────────────────────────────────────────────────
/**
 * GET /api/chat/socket-token
 * 🔒 customer_token  OR  partner_token
 *
 * Issues a short-lived JWT (2h) that the React Native app can pass to
 * Socket.IO via `socket.handshake.auth.token`.  The httpOnly session cookie
 * cannot be forwarded over a WebSocket handshake, so we exchange it here.
 */
router.get("/socket-token", flexAuth, (req, res) => {
  const callerId   = req.customerId ?? req.partnerId;
  const callerType = req.customerId ? "customer" : "partner";

  const token = jwt.sign(
    { id: callerId, userType: callerType },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  return res.status(200).json({ token, userType: callerType });
});

// ── Conversation routes ───────────────────────────────────────────────────────

// Get all conversations for the logged-in user (customer or partner)
router.get(  "/conversations",                          flexAuth, getMyConversations);

// Get or create the 1-to-1 conversation between a customer and a partner
router.post( "/conversations",                          flexAuth, getOrCreateConversation);

// Soft-delete a conversation from the caller's inbox
router.delete("/conversations/:conversationId",         flexAuth, deleteConversation);

// Mark all messages in a conversation as read (reset unread counter)
router.patch( "/conversations/:conversationId/read",    flexAuth, markConversationRead);

// ── Message routes ────────────────────────────────────────────────────────────

// Get paginated messages for a conversation (also marks them as read)
router.get(  "/conversations/:conversationId/messages", flexAuth, getMessages);

// Send a message — text only (application/json) or with image (multipart/form-data)
// upload.single("image") parses the file; if no file is present the middleware
// simply moves on without error, so JSON-only requests also work fine.
router.post(
  "/conversations/:conversationId/messages",
  flexAuth,
  upload.single("image"),
  sendMessage
);

// Soft-delete a single message (sender only)
router.delete("/messages/:messageId", flexAuth, deleteMessage);

export default router;
