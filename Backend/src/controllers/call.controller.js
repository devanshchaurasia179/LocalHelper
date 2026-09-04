import { AccessToken } from "livekit-server-sdk";
import crypto from "crypto";

import Call from "../models/call/call.js";
import Customer from "../models/customer/Customer.js";
import Partner from "../models/partner/Partner.js";
import { getIO } from "../socket/index.js";
import { startCallRecording, stopCallRecording } from "../services/callRecording.service.js";
import { startCallTimer, stopCallTimer, startRingTimer, stopRingTimer } from "../socket/call.socket.js";
import { sendToUser } from "../services/notification.service.js";

// ─── Helper: count a user's registered FCM tokens ──────────────────────────────
const countFcmTokens = (user) =>
  (user?.fcmTokens || []).filter((t) => typeof t?.token === "string" && t.token.length > 0).length;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build and sign a LiveKit JWT for the given identity/room.
 */
const buildLiveKitToken = async ({ identity, displayName, roomName }) => {
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity,
      name: displayName,
      ttl: "1h",
    }
  );

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return token.toJwt();
};

// ─── Customer → Partner call ───────────────────────────────────────────────────

export const createCall = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { partnerId } = req.body;

    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: "Partner ID is required",
      });
    }

    const customer = await Customer.findById(customerId).select("blockedPartners name walletBalance");
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Check if customer has sufficient wallet balance for at least 1 minute (₹30)
    const minimumCharge = 30; // ₹30 for 1 minute
    if (customer.walletBalance < minimumCharge) {
      return res.status(402).json({
        success: false,
        message: "Insufficient wallet balance. Please recharge to make calls.",
        code: "INSUFFICIENT_BALANCE",
        walletBalance: customer.walletBalance || 0,
        minimumRequired: minimumCharge,
      });
    }

    if (customer.blockedPartners?.some((id) => id.equals(partnerId))) {
      return res.status(403).json({
        success: false,
        message: "You have blocked this partner",
      });
    }

    const partner = await Partner.findById(partnerId).select("blockedCustomers accountStatus fullName fcmTokens walletBalance");
    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    if (partner.blockedCustomers?.some((id) => id.equals(customerId))) {
      return res.status(403).json({
        success: false,
        message: "You cannot call this partner",
      });
    }

    if (partner.accountStatus !== "Active") {
      return res.status(403).json({
        success: false,
        message: "Partner account is not available",
      });
    }

    // Check if partner also has sufficient balance to participate in the call
    if ((partner.walletBalance ?? 0) < minimumCharge) {
      return res.status(402).json({
        success: false,
        message: `${partner.fullName ?? "The partner"} does not have sufficient funds to receive calls right now.`,
        code: "PARTNER_INSUFFICIENT_BALANCE",
        minimumRequired: minimumCharge,
      });
    }

    // Create room & call record
    const roomName = `call_${crypto.randomUUID()}`;

    // Calculate allowed time based on the minimum wallet balance between both parties
    // Rate: ₹30 per minute — both wallets are charged, so the call ends when either runs out
    const customerMaxMinutes = Math.floor(customer.walletBalance / 30);
    const partnerMaxMinutes  = Math.floor((partner.walletBalance ?? 0) / 30);
    const maxMinutes = Math.min(customerMaxMinutes, partnerMaxMinutes);
    const allowedTime = maxMinutes * 60; // Convert to seconds

    const call = await Call.create({
      customer: customerId,
      partner: partnerId,
      roomName,
      status: "ringing",
      initiatedBy: "customer",
      allowedTime,
    });

    // LiveKit token for customer
    const jwt = await buildLiveKitToken({
      identity: `customer_${customerId}`,
      displayName: customer.name || "Customer",
      roomName,
    });

    // Notify partner of incoming call via socket
    try {
      const io = getIO();
      const chatNS = io.of("/chat");
      const partnerRoom = `partner:${partnerId}`;
      const socketsInRoom = await chatNS.in(partnerRoom).fetchSockets();

      if (socketsInRoom.length === 0) {
        console.warn(`[Call] No sockets in room ${partnerRoom} — partner socket is offline`);
        // Socket offline is no longer a hard failure: if the partner has FCM
        // tokens, the push below will wake the device. Only fail if there are
        // no tokens at all (nothing can reach them).
        if (countFcmTokens(partner) === 0) {
          call.status = "failed";
          await call.save();
          return res.status(422).json({
            success: false,
            message: "Partner is currently offline. Please try again later.",
          });
        }
      } else {
        chatNS.to(partnerRoom).emit("incoming_call", {
          callId: call._id.toString(),
          roomName: call.roomName,
          customerId: customerId.toString(),
          customerName: customer.name || "Customer",
          timestamp: new Date(),
        });
        console.log(`[Call] incoming_call emitted to ${partnerRoom} (${socketsInRoom.length} sockets), callId: ${call._id}`);
      }
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
      // Don't hard-fail on socket errors if the partner has FCM tokens to wake.
      if (countFcmTokens(partner) === 0) {
        call.status = "failed";
        await call.save();
        return res.status(500).json({
          success: false,
          message: "Failed to notify partner. Please try again.",
        });
      }
    }

    // High-priority DATA push to wake the partner's device (fires regardless of
    // socket state; the service no-ops when there are no tokens).
    sendToUser({
      userType: "partner",
      userId: partnerId.toString(),
      type: "incoming_call",
      data: {
        callId: call._id.toString(),
        roomName: call.roomName,
        callerName: customer.name || "Customer",
        callerId: customerId.toString(),
      },
    }).catch((err) =>
      console.error("[Call] FCM incoming_call push error (non-blocking):", err?.message || err)
    );

    // Start 60-second ring timeout — auto-misses the call if nobody answers
    try {
      const io = getIO();
      startRingTimer(io.of("/chat"), call);
    } catch (ringErr) {
      console.error("[Call] Ring timer start error (non-blocking):", ringErr.message);
    }

    // Return call info but NOT the LiveKit token yet.
    // Customer should wait for "call_accepted" socket event before connecting to LiveKit.
    return res.status(201).json({
      success: true,
      call: {
        id: call._id,
        roomName: call.roomName,
        status: call.status,
        allowedTime: call.allowedTime,
      },
      livekit: {
        url: process.env.LIVEKIT_URL,
        token: jwt,
      },
    });
  } catch (error) {
    console.error("Create call error:", error);
    return res.status(500).json({ success: false, message: "Failed to create call" });
  }
};

// ─── Partner → Customer call ───────────────────────────────────────────────────

export const createCallAsPartner = async (req, res) => {
  try {
    const partnerId = req.partnerId;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    const partner = await Partner.findById(partnerId).select("blockedCustomers fullName walletBalance");
    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    // Check if partner has sufficient wallet balance for at least 1 minute (₹30)
    const minimumCharge = 30;
    if (partner.walletBalance < minimumCharge) {
      return res.status(402).json({
        success: false,
        message: "Insufficient wallet balance. Please recharge to make calls.",
        code: "INSUFFICIENT_BALANCE",
        walletBalance: partner.walletBalance || 0,
        minimumRequired: minimumCharge,
      });
    }

    if (partner.blockedCustomers?.some((id) => id.equals(customerId))) {
      return res.status(403).json({
        success: false,
        message: "You have blocked this customer",
      });
    }

    const customer = await Customer.findById(customerId).select("blockedPartners name fcmTokens walletBalance");
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Check if customer also has sufficient balance to participate in the call
    if (customer.walletBalance < minimumCharge) {
      return res.status(402).json({
        success: false,
        message: `${customer.name ?? "The customer"} does not have sufficient funds to receive calls right now.`,
        code: "CUSTOMER_INSUFFICIENT_BALANCE",
        minimumRequired: minimumCharge,
      });
    }

    if (customer.blockedPartners?.some((id) => id.equals(partnerId))) {
      return res.status(403).json({
        success: false,
        message: "You cannot call this customer",
      });
    }

    const roomName = `call_${crypto.randomUUID()}`;

    // Calculate allowed time based on the minimum wallet balance between both parties
    // Rate: ₹30 per minute
    const customerMaxMinutes = Math.floor(customer.walletBalance / 30);
    const partnerMaxMinutes = Math.floor(partner.walletBalance / 30);
    const maxMinutes = Math.min(customerMaxMinutes, partnerMaxMinutes);
    const allowedTime = maxMinutes * 60; // Convert to seconds

    const call = await Call.create({
      customer: customerId,
      partner: partnerId,
      roomName,
      status: "ringing",
      initiatedBy: "partner",
      allowedTime, // Based on minimum of both balances
    });

    // LiveKit token for partner
    const jwt = await buildLiveKitToken({
      identity: `partner_${partnerId}`,
      displayName: partner.fullName || "Partner",
      roomName,
    });

    // Notify customer of incoming call via socket
    try {
      const io = getIO();
      const chatNS = io.of("/chat");
      const customerRoom = `customer:${customerId}`;
      const socketsInRoom = await chatNS.in(customerRoom).fetchSockets();

      if (socketsInRoom.length === 0) {
        console.warn(`[Call] No sockets in room ${customerRoom} — customer socket is offline`);
        // Socket offline is no longer a hard failure: if the customer has FCM
        // tokens, the push below will wake the device. Only fail if there are
        // no tokens at all (nothing can reach them).
        if (countFcmTokens(customer) === 0) {
          call.status = "failed";
          await call.save();
          return res.status(422).json({
            success: false,
            message: "Customer is currently offline. Please try again later.",
          });
        }
      } else {
        chatNS.to(customerRoom).emit("incoming_call", {
          callId: call._id.toString(),
          roomName: call.roomName,
          partnerId: partnerId.toString(),
          partnerName: partner.fullName || "Partner",
          timestamp: new Date(),
        });
        console.log(`[Call] incoming_call emitted to ${customerRoom} (${socketsInRoom.length} sockets), callId: ${call._id}`);
      }
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
      // Don't hard-fail on socket errors if the customer has FCM tokens to wake.
      if (countFcmTokens(customer) === 0) {
        call.status = "failed";
        await call.save();
        return res.status(500).json({
          success: false,
          message: "Failed to notify customer. Please try again.",
        });
      }
    }

    // High-priority DATA push to wake the customer's device (fires regardless of
    // socket state; the service no-ops when there are no tokens).
    sendToUser({
      userType: "customer",
      userId: customerId.toString(),
      type: "incoming_call",
      data: {
        callId: call._id.toString(),
        roomName: call.roomName,
        callerName: partner.fullName || "Partner",
        callerId: partnerId.toString(),
      },
    }).catch((err) =>
      console.error("[Call] FCM incoming_call push error (non-blocking):", err?.message || err)
    );

    // Start 60-second ring timeout — auto-misses the call if nobody answers
    try {
      const io = getIO();
      startRingTimer(io.of("/chat"), call);
    } catch (ringErr) {
      console.error("[Call] Ring timer start error (non-blocking):", ringErr.message);
    }

    return res.status(201).json({
      success: true,
      call: {
        id: call._id,
        roomName: call.roomName,
        status: call.status,
      },
      livekit: {
        url: process.env.LIVEKIT_URL,
        token: jwt,
      },
    });
  } catch (error) {
    console.error("Create call as partner error:", error);
    return res.status(500).json({ success: false, message: "Failed to create call" });
  }
};

// ─── Block / Unblock ──────────────────────────────────────────────────────────

export const blockPartner = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { partnerId } = req.params;

    const partner = await Partner.findById(partnerId).select("_id");
    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    await Customer.findByIdAndUpdate(customerId, {
      $addToSet: { blockedPartners: partnerId },
    });

    return res.status(200).json({ success: true, message: "Partner blocked" });
  } catch (error) {
    console.error("Block partner error:", error);
    return res.status(500).json({ success: false, message: "Failed to block partner" });
  }
};

export const unblockPartner = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { partnerId } = req.params;

    await Customer.findByIdAndUpdate(customerId, {
      $pull: { blockedPartners: partnerId },
    });

    return res.status(200).json({ success: true, message: "Partner unblocked" });
  } catch (error) {
    console.error("Unblock partner error:", error);
    return res.status(500).json({ success: false, message: "Failed to unblock partner" });
  }
};

export const getBlockedPartners = async (req, res) => {
  try {
    const customerId = req.customerId;

    const customer = await Customer.findById(customerId)
      .select("blockedPartners")
      .populate("blockedPartners", "fullName profilePhoto phone")
      .lean();

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    return res.status(200).json({
      success: true,
      blockedPartners: customer.blockedPartners || [],
    });
  } catch (error) {
    console.error("Get blocked partners error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch blocked partners" });
  }
};

export const blockCustomer = async (req, res) => {
  try {
    const partnerId = req.partnerId;
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId).select("_id");
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    await Partner.findByIdAndUpdate(partnerId, {
      $addToSet: { blockedCustomers: customerId },
    });

    return res.status(200).json({ success: true, message: "Customer blocked" });
  } catch (error) {
    console.error("Block customer error:", error);
    return res.status(500).json({ success: false, message: "Failed to block customer" });
  }
};

export const unblockCustomer = async (req, res) => {
  try {
    const partnerId = req.partnerId;
    const { customerId } = req.params;

    await Partner.findByIdAndUpdate(partnerId, {
      $pull: { blockedCustomers: customerId },
    });

    return res.status(200).json({ success: true, message: "Customer unblocked" });
  } catch (error) {
    console.error("Unblock customer error:", error);
    return res.status(500).json({ success: false, message: "Failed to unblock customer" });
  }
};

// ─── Accept / Reject Call ─────────────────────────────────────────────────────

export const acceptCall = async (req, res) => {
  try {
    const partnerId = req.partnerId;
    const { callId } = req.params;

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (!call.partner.equals(partnerId)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (call.status !== "ringing") {
      return res.status(400).json({
        success: false,
        message: `Call cannot be accepted (current status: ${call.status})`,
      });
    }

    // Update call status
    call.status = "accepted";
    call.startedAt = new Date();
    await call.save();

    // Cancel the ring timeout — call has been answered
    stopRingTimer(call._id.toString());

    const partner = await Partner.findById(partnerId).select("fullName");

    // Generate LiveKit token for partner
    const jwt = await buildLiveKitToken({
      identity: `partner_${partnerId}`,
      displayName: partner?.fullName || "Partner",
      roomName: call.roomName,
    });

    // Start recording (non-blocking — don't let failure affect the call)
    startCallRecording(call).catch((err) =>
      console.error("[Call] Recording start error (non-blocking):", err.message)
    );

    // Start call timer for customer-initiated calls
    if (call.initiatedBy === "customer" && call.allowedTime) {
      try {
        const io = getIO();
        const chatNS = io.of("/chat");
        startCallTimer(chatNS, call);
      } catch (timerErr) {
        console.error("[Call] Timer start error (non-blocking):", timerErr.message);
      }
    }

    // Notify customer via socket that call was accepted — include LiveKit details
    // so the customer can now connect to the room
    try {
      const io = getIO();
      const chatNS = io.of("/chat");

      // Generate a fresh LiveKit token for the customer so they can join now
      const customerJwt = await buildLiveKitToken({
        identity: `customer_${call.customer}`,
        displayName: "Customer",
        roomName: call.roomName,
      });

      chatNS.to(`customer:${call.customer}`).emit("call_accepted", {
        callId: call._id.toString(),
        roomName: call.roomName,
        partnerId: partnerId.toString(),
        partnerName: partner?.fullName || "Partner",
        allowedTime: call.allowedTime,
        livekit: {
          url: process.env.LIVEKIT_URL,
          token: customerJwt,
        },
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
    }

    // DATA push so any native incoming-call UI on the partner's device dismisses.
    sendToUser({
      userType: "partner",
      userId: partnerId.toString(),
      type: "call_cancel",
      data: { callId: call._id.toString() },
    }).catch((err) =>
      console.error("[Call] FCM call_cancel push error (non-blocking):", err?.message || err)
    );

    return res.status(200).json({
      success: true,
      call: {
        id: call._id,
        roomName: call.roomName,
        status: call.status,
      },
      livekit: {
        url: process.env.LIVEKIT_URL,
        token: jwt,
      },
    });
  } catch (error) {
    console.error("Accept call error:", error);
    return res.status(500).json({ success: false, message: "Failed to accept call" });
  }
};

export const rejectCall = async (req, res) => {
  try {
    const partnerId = req.partnerId;
    const { callId } = req.params;

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (!call.partner.equals(partnerId)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (call.status !== "ringing") {
      return res.status(400).json({
        success: false,
        message: `Call cannot be rejected (current status: ${call.status})`,
      });
    }

    call.status = "rejected";
    call.endedAt = new Date();
    await call.save();

    // Cancel the ring timeout — call has been declined
    stopRingTimer(call._id.toString());

    // Notify customer via socket
    try {
      const io = getIO();
      const chatNS = io.of("/chat");
      chatNS.to(`customer:${call.customer}`).emit("call_rejected", {
        callId: call._id.toString(),
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
    }

    // DATA push so any native incoming-call UI on the partner's device dismisses.
    sendToUser({
      userType: "partner",
      userId: partnerId.toString(),
      type: "call_cancel",
      data: { callId: call._id.toString() },
    }).catch((err) =>
      console.error("[Call] FCM call_cancel push error (non-blocking):", err?.message || err)
    );

    return res.status(200).json({
      success: true,
      message: "Call rejected",
      call: {
        id: call._id,
        status: call.status,
      },
    });
  } catch (error) {
    console.error("Reject call error:", error);
    return res.status(500).json({ success: false, message: "Failed to reject call" });
  }
};

// ─── Customer accepts incoming call (from partner) ────────────────────────────

export const acceptCallAsCustomer = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { callId } = req.params;

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (!call.customer.equals(customerId)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (call.status !== "ringing") {
      return res.status(400).json({
        success: false,
        message: `Call cannot be accepted (current status: ${call.status})`,
      });
    }

    // Update call status
    call.status = "accepted";
    call.startedAt = new Date();
    await call.save();

    // Cancel the ring timeout — call has been answered
    stopRingTimer(call._id.toString());

    const customer = await Customer.findById(customerId).select("name");

    // Generate LiveKit token for customer
    const jwt = await buildLiveKitToken({
      identity: `customer_${customerId}`,
      displayName: customer?.name || "Customer",
      roomName: call.roomName,
    });

    // Start recording (non-blocking — don't let failure affect the call)
    startCallRecording(call).catch((err) =>
      console.error("[Call] Recording start error (non-blocking):", err.message)
    );

    // Start call timer for partner-initiated calls (now also timed based on balances)
    if (call.allowedTime) {
      try {
        const io = getIO();
        const chatNS = io.of("/chat");
        startCallTimer(chatNS, call);
      } catch (timerErr) {
        console.error("[Call] Timer start error (non-blocking):", timerErr.message);
      }
    }

    // Notify partner via socket that call was accepted
    try {
      const io = getIO();
      const chatNS = io.of("/chat");
      chatNS.to(`partner:${call.partner}`).emit("call_accepted", {
        callId: call._id.toString(),
        roomName: call.roomName,
        customerId: customerId.toString(),
        customerName: customer?.name || "Customer",
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
    }

    // DATA push so any native incoming-call UI on the customer's device dismisses.
    sendToUser({
      userType: "customer",
      userId: customerId.toString(),
      type: "call_cancel",
      data: { callId: call._id.toString() },
    }).catch((err) =>
      console.error("[Call] FCM call_cancel push error (non-blocking):", err?.message || err)
    );

    return res.status(200).json({
      success: true,
      call: {
        id: call._id,
        roomName: call.roomName,
        status: call.status,
      },
      livekit: {
        url: process.env.LIVEKIT_URL,
        token: jwt,
      },
    });
  } catch (error) {
    console.error("Accept call as customer error:", error);
    return res.status(500).json({ success: false, message: "Failed to accept call" });
  }
};

// ─── Customer rejects incoming call (from partner) ────────────────────────────

export const rejectCallAsCustomer = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { callId } = req.params;

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (!call.customer.equals(customerId)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (call.status !== "ringing") {
      return res.status(400).json({
        success: false,
        message: `Call cannot be rejected (current status: ${call.status})`,
      });
    }

    call.status = "rejected";
    call.endedAt = new Date();
    await call.save();

    // Cancel the ring timeout — call has been declined
    stopRingTimer(call._id.toString());

    // Notify partner via socket
    try {
      const io = getIO();
      const chatNS = io.of("/chat");
      chatNS.to(`partner:${call.partner}`).emit("call_rejected", {
        callId: call._id.toString(),
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
    }

    // DATA push so any native incoming-call UI on the customer's device dismisses.
    sendToUser({
      userType: "customer",
      userId: customerId.toString(),
      type: "call_cancel",
      data: { callId: call._id.toString() },
    }).catch((err) =>
      console.error("[Call] FCM call_cancel push error (non-blocking):", err?.message || err)
    );

    return res.status(200).json({
      success: true,
      message: "Call rejected",
      call: {
        id: call._id,
        status: call.status,
      },
    });
  } catch (error) {
    console.error("Reject call as customer error:", error);
    return res.status(500).json({ success: false, message: "Failed to reject call" });
  }
};

export const endCall = async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.customerId || req.partnerId;
    const userType = req.customerId ? "customer" : "partner";

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    const isAuthorized =
      (userType === "customer" && call.customer.equals(userId)) ||
      (userType === "partner" && call.partner.equals(userId));

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // ── Caller cancels while still ringing → mark as missed ──────────────────
    // This happens when the initiating party hangs up before the other answers.
    if (call.status === "ringing") {
      call.status  = "missed";
      call.endedAt = new Date();
      await call.save();

      // Cancel the ring timeout so it doesn't fire again
      stopRingTimer(call._id.toString());

      const io = getIO();
      const chatNS = io.of("/chat");

      // Notify both parties via socket
      chatNS.to(`customer:${call.customer}`).emit("call_missed", {
        callId: call._id.toString(),
        initiatedBy: call.initiatedBy,
        cancelledBy: userType,
        timestamp: call.endedAt,
      });
      chatNS.to(`partner:${call.partner}`).emit("call_missed", {
        callId: call._id.toString(),
        initiatedBy: call.initiatedBy,
        cancelledBy: userType,
        timestamp: call.endedAt,
      });

      // FCM: tell the callee their incoming call was cancelled
      const calleeType = call.initiatedBy === "customer" ? "partner" : "customer";
      const calleeId   = calleeType === "partner"
        ? call.partner.toString()
        : call.customer.toString();

      // Dismiss the incoming-call notification on the callee's device
      sendToUser({
        userType: calleeType,
        userId:   calleeId,
        type:     "call_cancel",
        data:     { callId: call._id.toString() },
      }).catch((err) =>
        console.error("[Call] FCM call_cancel (ringing cancel) push error:", err?.message || err)
      );

      return res.status(200).json({
        success: true,
        message: "Call cancelled",
        call: { id: call._id, status: call.status },
      });
    }

    if (!["accepted", "ongoing"].includes(call.status)) {
      return res.status(400).json({
        success: false,
        message: `Call cannot be ended (current status: ${call.status})`,
      });
    }

    const endTime = new Date();
    const duration = call.startedAt
      ? Math.floor((endTime - call.startedAt) / 1000)
      : 0;

    call.status = "completed";
    call.endedAt = endTime;
    call.duration = duration;
    await call.save();

    // ── Deduct call charges from both customer and partner wallets ──────────────
    // Rate: ₹30 per minute for both parties
    if (duration > 0) {
      // Stop the call timer
      stopCallTimer(call._id.toString());

      const durationMinutes = Math.ceil(duration / 60); // Round up to next minute
      const chargePerMinute = 30; // ₹30 per minute
      const totalCharge = durationMinutes * chargePerMinute;

      // Import transaction helpers
      const { createCommunicationTransaction } = await import("./customer.wallet.controller.js");
      const { createPartnerTransaction } = await import("./partner.transaction.controller.js");

      // Fetch current balances to clamp charges
      const [customerDoc, partnerDoc] = await Promise.all([
        Customer.findById(call.customer).select("walletBalance"),
        Partner.findById(call.partner).select("walletBalance"),
      ]);

      const customerBalance = customerDoc?.walletBalance || 0;
      const partnerBalance = partnerDoc?.walletBalance || 0;

      // Deduct from customer wallet (clamped to available balance, minimum 0)
      const customerCharge = Math.min(totalCharge, Math.max(0, customerBalance));
      if (customerCharge > 0) {
        try {
          await createCommunicationTransaction(
            call.customer,
            call.partner,
            "call",
            customerCharge,
            `Call charges - ${durationMinutes} min @ ₹${chargePerMinute}/min`
          );
        } catch (walletError) {
          console.error("[Call] Customer wallet deduction error:", walletError.message);
          // Fallback: direct deduction (clamped to not go negative)
          await Customer.findByIdAndUpdate(call.customer, {
            walletBalance: Math.max(0, customerBalance - customerCharge),
          });
        }
      }

      // Deduct from partner wallet (clamped to available balance, minimum 0)
      const partnerCharge = Math.min(totalCharge, Math.max(0, partnerBalance));
      if (partnerCharge > 0) {
        try {
          await createPartnerTransaction(
            call.partner,
            "call_charge",
            -partnerCharge, // Negative for deduction
            `Call charges - ${durationMinutes} min @ ₹${chargePerMinute}/min`
          );
        } catch (walletError) {
          console.error("[Call] Partner wallet deduction error:", walletError.message);
          // Fallback: direct deduction (clamped to not go negative)
          await Partner.findByIdAndUpdate(call.partner, {
            walletBalance: Math.max(0, partnerBalance - partnerCharge),
          });
        }
      }
    } else {
      // Still stop the timer if it exists
      stopCallTimer(call._id.toString());
    }

    // Stop recording (non-blocking — don't let failure affect call termination)
    stopCallRecording(call).catch((err) =>
      console.error("[Call] Recording stop error (non-blocking):", err.message)
    );

    // Notify the other party
    try {
      const io = getIO();
      const chatNS = io.of("/chat");
      const targetRoom =
        userType === "customer"
          ? `partner:${call.partner}`
          : `customer:${call.customer}`;

      chatNS.to(targetRoom).emit("call_ended", {
        callId: call._id.toString(),
        duration,
        endedBy: userType,
        timestamp: endTime,
      });

      // Also notify the caller's own room so their UI updates immediately
      const callerRoom =
        userType === "customer"
          ? `customer:${call.customer}`
          : `partner:${call.partner}`;

      chatNS.to(callerRoom).emit("call_ended", {
        callId: call._id.toString(),
        duration,
        endedBy: userType,
        timestamp: endTime,
      });
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
    }

    // DATA push to both parties so any native call UI dismisses on end.
    sendToUser({
      userType: "partner",
      userId: call.partner.toString(),
      type: "call_cancel",
      data: { callId: call._id.toString() },
    }).catch((err) =>
      console.error("[Call] FCM call_cancel push error (non-blocking):", err?.message || err)
    );
    sendToUser({
      userType: "customer",
      userId: call.customer.toString(),
      type: "call_cancel",
      data: { callId: call._id.toString() },
    }).catch((err) =>
      console.error("[Call] FCM call_cancel push error (non-blocking):", err?.message || err)
    );

    return res.status(200).json({
      success: true,
      message: "Call ended",
      call: {
        id: call._id,
        status: call.status,
        duration,
      },
    });
  } catch (error) {
    console.error("End call error:", error);
    return res.status(500).json({ success: false, message: "Failed to end call" });
  }
};


// ─── DEPRECATED: Call Balance Recharge (Old System) ──────────────────────────

/**
 * POST /api/calls/recharge
 * 🔒 customer_token
 * @deprecated - This endpoint is deprecated. Calls now charge directly from wallet at ₹30/min.
 *
 * Returns deprecation notice.
 */
export const rechargeCallBalance = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: "This endpoint is deprecated. Calls now charge directly from your wallet at ₹30 per minute. No separate call balance needed.",
    code: "DEPRECATED_ENDPOINT",
    newRate: {
      perMinute: 30,
      currency: "INR"
    }
  });
};

/**
 * GET /api/calls/balance
 * 🔒 customer_token
 * @deprecated - This endpoint is deprecated.
 *
 * Returns deprecation notice.
 * Returns the customer's current call balance.
 */
export const getCallBalance = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: "This endpoint is deprecated. Calls now charge directly from your wallet at ₹30 per minute.",
    code: "DEPRECATED_ENDPOINT",
    recommendation: "Check your wallet balance instead using GET /api/customer/transactions/summary",
    newRate: {
      perMinute: 30,
      currency: "INR"
    }
  });
};

/**
 * POST /api/calls/recharge-during-call
 * 🔒 customer_token
 *
 * Body: { callId, amount }
 *
 * Recharges call balance AND extends the current active call's allowed time.
 * Used when customer gets "call_time_warning" and wants to continue.
 */
export const rechargeDuringCall = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: "This endpoint is deprecated. Calls now charge automatically from your wallet. Ensure sufficient balance before calling.",
    code: "DEPRECATED_ENDPOINT",
    newRate: {
      perMinute: 30,
      currency: "INR"
    }
  });
};

// ─── Active Call (for dashboard card) ─────────────────────────────────────────

/**
 * GET /api/calls/active
 * 🔒 customer_token
 *
 * Returns the customer's current active call (ringing/accepted/ongoing)
 * with allowedTime and startedAt so the client can compute remaining time.
 * Returns null if no active call exists.
 */
export const getActiveCall = async (req, res) => {
  try {
    const customerId = req.customerId;

    const activeCall = await Call.findOne({
      customer: customerId,
      status: { $in: ["ringing", "accepted", "ongoing"] },
    })
      .populate("partner", "fullName profilePhoto")
      .sort({ createdAt: -1 })
      .lean();

    if (!activeCall) {
      return res.status(200).json({ success: true, activeCall: null });
    }

    return res.status(200).json({
      success: true,
      activeCall: {
        _id: activeCall._id,
        partner: {
          _id: activeCall.partner._id,
          fullName: activeCall.partner.fullName,
          profilePhoto: activeCall.partner.profilePhoto ?? null,
        },
        status: activeCall.status,
        allowedTime: activeCall.allowedTime, // total seconds allowed
        startedAt: activeCall.startedAt,     // null if not yet started (ringing)
        createdAt: activeCall.createdAt,
      },
    });
  } catch (error) {
    console.error("Get active call error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch active call" });
  }
};

// ─── Call History ─────────────────────────────────────────────────────────────

export const getCallHistory = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const calls = await Call.find({ customer: customerId })
      .populate("partner", "fullName profilePhoto phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Call.countDocuments({ customer: customerId });

    return res.status(200).json({
      success: true,
      calls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get call history error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch call history" });
  }
};

export const getPartnerCallHistory = async (req, res) => {
  try {
    const partnerId = req.partnerId;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const calls = await Call.find({ partner: partnerId })
      .populate("customer", "name profilePhoto phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Call.countDocuments({ partner: partnerId });

    return res.status(200).json({
      success: true,
      calls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get partner call history error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch call history" });
  }
};
