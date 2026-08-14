import express from "express";
import { protectAdmin } from "../../middleware/admin.auth.middleware.js";
import {
  adminGetAllConversations,
  adminGetPartnerConversations,
  adminGetConversationMessages,
  adminCloseConversation,
  adminReopenConversation,
} from "../../controllers/admin/admin.chat.controller.js";

const router = express.Router();

// All routes require a valid admin session
router.use(protectAdmin);

// GET  /api/admin/conversations                                — all conversations (platform-wide)
router.get("/conversations", adminGetAllConversations);

// GET  /api/admin/partners/:partnerId/conversations            — all conversations for one partner
router.get("/partners/:partnerId/conversations", adminGetPartnerConversations);

// GET  /api/admin/conversations/:conversationId/messages       — full message thread
router.get("/conversations/:conversationId/messages", adminGetConversationMessages);

// PATCH /api/admin/conversations/:conversationId/close         — close / lock a conversation
router.patch("/conversations/:conversationId/close", adminCloseConversation);

// PATCH /api/admin/conversations/:conversationId/reopen        — reopen a closed conversation
router.patch("/conversations/:conversationId/reopen", adminReopenConversation);

export default router;
