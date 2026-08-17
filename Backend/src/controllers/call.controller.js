import { AccessToken } from "livekit-server-sdk";
import crypto from "crypto";

import Call from "../models/call/call.js";
import Customer from "../models/customer/Customer.js";
import Partner from "../models/partner/Partner.js";
import { getIO } from "../socket/index.js";

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

    const customer = await Customer.findById(customerId).select("blockedPartners name");
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (customer.blockedPartners?.some((id) => id.equals(partnerId))) {
      return res.status(403).json({
        success: false,
        message: "You have blocked this partner",
      });
    }

    const partner = await Partner.findById(partnerId).select("blockedCustomers accountStatus fullName");
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

    // Create room & call record
    const roomName = `call_${crypto.randomUUID()}`;

    const call = await Call.create({
      customer: customerId,
      partner: partnerId,
      roomName,
      status: "ringing",
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
        console.warn(`[Call] No sockets in room ${partnerRoom} — partner may be offline`);
      }

      chatNS.to(partnerRoom).emit("incoming_call", {
        callId: call._id.toString(),
        roomName: call.roomName,
        customerId: customerId.toString(),
        customerName: customer.name || "Customer",
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
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

    const partner = await Partner.findById(partnerId).select("blockedCustomers fullName");
    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    if (partner.blockedCustomers?.some((id) => id.equals(customerId))) {
      return res.status(403).json({
        success: false,
        message: "You have blocked this customer",
      });
    }

    const customer = await Customer.findById(customerId).select("blockedPartners name");
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (customer.blockedPartners?.some((id) => id.equals(partnerId))) {
      return res.status(403).json({
        success: false,
        message: "You cannot call this customer",
      });
    }

    const roomName = `call_${crypto.randomUUID()}`;

    const call = await Call.create({
      customer: customerId,
      partner: partnerId,
      roomName,
      status: "ringing",
    });

    // LiveKit token for partner
    const jwt = await buildLiveKitToken({
      identity: `partner_${partnerId}`,
      displayName: partner.fullName || "Partner",
      roomName,
    });

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

    const partner = await Partner.findById(partnerId).select("fullName");

    // Generate LiveKit token for partner
    const jwt = await buildLiveKitToken({
      identity: `partner_${partnerId}`,
      displayName: partner?.fullName || "Partner",
      roomName: call.roomName,
    });

    // Notify customer via socket that call was accepted
    try {
      const io = getIO();
      const chatNS = io.of("/chat");
      chatNS.to(`customer:${call.customer}`).emit("call_accepted", {
        callId: call._id.toString(),
        roomName: call.roomName,
        partnerId: partnerId.toString(),
        partnerName: partner?.fullName || "Partner",
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
    }

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
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
    }

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
