import { AccessToken } from "livekit-server-sdk";
import crypto from "crypto";

import Call from "../models/call/call.js";
import Customer from "../models/customer/Customer.js";
import Partner from "../models/partner/Partner.js";
import { getIO } from "../socket/index.js";
import { startCallRecording, stopCallRecording } from "../services/callRecording.service.js";
import { startCallTimer, stopCallTimer } from "../socket/call.socket.js";

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

    const customer = await Customer.findById(customerId).select("blockedPartners name callBalance walletBalance");
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Fetch partner's call charges to determine billing model
    const partnerForCharges = await Partner.findById(partnerId).select("callCharges");
    const partnerCallCharge = partnerForCharges?.callCharges?.amount ?? 0;

    // If the partner uses per-call charges (flat fee), the customer pays via
    // the /api/bookings/call/:partnerId endpoint BEFORE reaching here.
    // In that case we skip the callBalance check.
    // If no partner call charges are set, fall back to the callBalance (recharge) model.
    if (partnerCallCharge === 0) {
      // Recharge-based model: check callBalance (seconds)
      if (!customer.callBalance || customer.callBalance < 60) {
        return res.status(402).json({
          success: false,
          message: "Insufficient call balance. Please recharge to make calls.",
          code: "INSUFFICIENT_BALANCE",
          callBalance: customer.callBalance || 0,
        });
      }
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

    // Determine allowed time:
    // - If partner has callCharges (flat-fee model): use partner's durationMinutes
    // - Otherwise (recharge model): use customer's callBalance in seconds
    const allowedTime = partnerCallCharge > 0
      ? (partnerForCharges.callCharges.durationMinutes ?? 10) * 60 // convert minutes to seconds
      : customer.callBalance;

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
        console.warn(`[Call] No sockets in room ${partnerRoom} — partner is offline`);
        // Mark call as failed since partner can't receive it
        call.status = "failed";
        await call.save();
        return res.status(422).json({
          success: false,
          message: "Partner is currently offline. Please try again later.",
        });
      }

      chatNS.to(partnerRoom).emit("incoming_call", {
        callId: call._id.toString(),
        roomName: call.roomName,
        customerId: customerId.toString(),
        customerName: customer.name || "Customer",
        timestamp: new Date(),
      });
      console.log(`[Call] incoming_call emitted to ${partnerRoom} (${socketsInRoom.length} sockets), callId: ${call._id}`);
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
      call.status = "failed";
      await call.save();
      return res.status(500).json({
        success: false,
        message: "Failed to notify partner. Please try again.",
      });
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
      initiatedBy: "partner",
      allowedTime: null, // Partner-initiated calls are unlimited
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
        console.warn(`[Call] No sockets in room ${customerRoom} — customer is offline`);
        call.status = "failed";
        await call.save();
        return res.status(422).json({
          success: false,
          message: "Customer is currently offline. Please try again later.",
        });
      }

      chatNS.to(customerRoom).emit("incoming_call", {
        callId: call._id.toString(),
        roomName: call.roomName,
        partnerId: partnerId.toString(),
        partnerName: partner.fullName || "Partner",
        timestamp: new Date(),
      });
      console.log(`[Call] incoming_call emitted to ${customerRoom} (${socketsInRoom.length} sockets), callId: ${call._id}`);
    } catch (socketError) {
      console.error("[Call] Failed to emit socket event:", socketError);
      call.status = "failed";
      await call.save();
      return res.status(500).json({
        success: false,
        message: "Failed to notify customer. Please try again.",
      });
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

    // ── Deduct call balance from customer (only for customer-initiated calls) ──
    if (call.initiatedBy === "customer" && duration > 0) {
      // Stop the call timer
      stopCallTimer(call._id.toString());

      // Determine billing model:
      // If the partner has callCharges (flat-fee model), the customer already
      // paid upfront via /api/bookings/call/:partnerId — no further deduction.
      // If no callCharges, use the recharge-based (callBalance) model.
      const partnerDoc = await Partner.findById(call.partner).select("callCharges");
      const isPrePaid = (partnerDoc?.callCharges?.amount ?? 0) > 0;

      if (!isPrePaid) {
        // Recharge-based model: deduct seconds from callBalance
        const deductSeconds = Math.min(duration, call.allowedTime || duration);
        await Customer.findByIdAndUpdate(call.customer, {
          $inc: { callBalance: -deductSeconds },
        });
      }
      // For pre-paid (flat-fee) model, no deduction needed — already charged.
    } else {
      // Still stop the timer if it exists (partner-initiated won't have one, but just in case)
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


// ─── Call Balance: Recharge ────────────────────────────────────────────────────

/**
 * POST /api/calls/recharge
 * 🔒 customer_token
 *
 * Body: { amount } — amount in ₹. Rate: ₹20 = 10 min (600 seconds)
 *
 * Deducts from wallet balance and adds to callBalance (in seconds).
 */
export const rechargeCallBalance = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number.",
      });
    }

    const rechargeAmount = Number(amount);

    // Rate: ₹20 per 10 min = ₹2 per minute = 30 seconds per ₹1
    const secondsToAdd = Math.floor((rechargeAmount / 20) * 600);

    if (secondsToAdd < 60) {
      return res.status(400).json({
        success: false,
        message: "Minimum recharge is ₹2 (1 minute).",
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (customer.walletBalance < rechargeAmount) {
      return res.status(402).json({
        success: false,
        message: "Insufficient wallet balance. Please top up your wallet first.",
        walletBalance: customer.walletBalance,
      });
    }

    // Deduct from wallet and add to callBalance
    const newWalletBalance = customer.walletBalance - rechargeAmount;
    const newCallBalance = (customer.callBalance || 0) + secondsToAdd;

    await Customer.findByIdAndUpdate(customerId, {
      $inc: { walletBalance: -rechargeAmount, callBalance: secondsToAdd },
    });

    // Record transaction
    const CustomerTransaction = (await import("../models/customer/customer.wallet.js")).default;
    await CustomerTransaction.create({
      customer: customerId,
      type: "call",
      amount: rechargeAmount,
      direction: "debit",
      balanceAfter: newWalletBalance,
      status: "completed",
      description: `Call recharge: ${Math.floor(secondsToAdd / 60)} min added`,
    });

    return res.status(200).json({
      success: true,
      message: `${Math.floor(secondsToAdd / 60)} minutes added to call balance.`,
      callBalance: newCallBalance,
      callBalanceMinutes: Math.floor(newCallBalance / 60),
      walletBalance: newWalletBalance,
    });
  } catch (error) {
    console.error("Recharge call balance error:", error);
    return res.status(500).json({ success: false, message: "Failed to recharge call balance" });
  }
};

/**
 * GET /api/calls/balance
 * 🔒 customer_token
 *
 * Returns the customer's current call balance.
 */
export const getCallBalance = async (req, res) => {
  try {
    const customer = await Customer.findById(req.customerId).select("callBalance");
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const callBalance = customer.callBalance || 0;

    return res.status(200).json({
      success: true,
      callBalance,
      callBalanceMinutes: Math.floor(callBalance / 60),
      rate: {
        amount: 20,
        minutes: 10,
        description: "₹20 per 10 minutes",
      },
    });
  } catch (error) {
    console.error("Get call balance error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch call balance" });
  }
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
  try {
    const customerId = req.customerId;
    const { callId, amount } = req.body;

    if (!callId || !amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "callId and a positive amount are required.",
      });
    }

    const rechargeAmount = Number(amount);
    const secondsToAdd = Math.floor((rechargeAmount / 20) * 600);

    if (secondsToAdd < 60) {
      return res.status(400).json({
        success: false,
        message: "Minimum recharge is ₹2 (1 minute).",
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (customer.walletBalance < rechargeAmount) {
      return res.status(402).json({
        success: false,
        message: "Insufficient wallet balance.",
        walletBalance: customer.walletBalance,
      });
    }

    // Verify the call belongs to this customer and is active
    const call = await Call.findById(callId);
    if (!call || !call.customer.equals(customerId)) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }
    if (!["accepted", "ongoing"].includes(call.status)) {
      return res.status(400).json({
        success: false,
        message: "Call is not active.",
      });
    }

    // Deduct from wallet, add to callBalance
    await Customer.findByIdAndUpdate(customerId, {
      $inc: { walletBalance: -rechargeAmount, callBalance: secondsToAdd },
    });

    // Record transaction
    const CustomerTransaction = (await import("../models/customer/customer.wallet.js")).default;
    const newWalletBalance = customer.walletBalance - rechargeAmount;
    await CustomerTransaction.create({
      customer: customerId,
      type: "call",
      amount: rechargeAmount,
      direction: "debit",
      balanceAfter: newWalletBalance,
      status: "completed",
      description: `Mid-call recharge: ${Math.floor(secondsToAdd / 60)} min added`,
    });

    // Extend the active call timer
    const { extendCallTime } = await import("../socket/call.socket.js");
    const io = getIO();
    const chatNS = io.of("/chat");
    await extendCallTime(chatNS, callId, secondsToAdd);

    return res.status(200).json({
      success: true,
      message: `${Math.floor(secondsToAdd / 60)} minutes added. Call extended.`,
      callBalance: (customer.callBalance || 0) + secondsToAdd,
      walletBalance: newWalletBalance,
    });
  } catch (error) {
    console.error("Recharge during call error:", error);
    return res.status(500).json({ success: false, message: "Failed to recharge" });
  }
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
