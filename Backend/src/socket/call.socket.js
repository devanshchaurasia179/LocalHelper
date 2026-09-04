import Call from "../models/call/call.js";
import Customer from "../models/customer/Customer.js";
import Partner from "../models/partner/Partner.js";
import { sendToUser } from "../services/notification.service.js";

// ─── Ring timeout (60 s) ──────────────────────────────────────────────────────

/** In-memory store for ringing timeouts. Key: callId, Value: timeoutId */
const activeRingTimers = new Map();

const RING_TIMEOUT_MS = 60_000; // 60 seconds

/**
 * startRingTimer(namespace, call)
 *
 * Starts a 60-second countdown after a call is created.
 * If the call is still "ringing" when the timer fires it is marked "missed",
 * `call_missed` is emitted to both parties via socket, and a "Missed Call"
 * FCM push is sent to the callee (the party who should have answered).
 */
export const startRingTimer = (namespace, call) => {
  const callId = call._id.toString();
  if (activeRingTimers.has(callId)) return; // already tracking

  const timeoutId = setTimeout(async () => {
    activeRingTimers.delete(callId);

    try {
      // Re-fetch so we don't act on a call that was already resolved.
      const callDoc = await Call.findById(callId)
        .populate("customer", "name fcmTokens")
        .populate("partner", "fullName fcmTokens");

      if (!callDoc || callDoc.status !== "ringing") return;

      callDoc.status  = "missed";
      callDoc.endedAt = new Date();
      await callDoc.save();

      const customerRoom = `customer:${callDoc.customer._id}`;
      const partnerRoom  = `partner:${callDoc.partner._id}`;

      // Socket events — both sides learn the call was missed
      namespace.to(customerRoom).emit("call_missed", {
        callId,
        initiatedBy: callDoc.initiatedBy,
        timestamp:   callDoc.endedAt,
      });
      namespace.to(partnerRoom).emit("call_missed", {
        callId,
        initiatedBy: callDoc.initiatedBy,
        timestamp:   callDoc.endedAt,
      });

      console.log(`[RingTimer] Call ${callId} missed after ${RING_TIMEOUT_MS / 1000}s`);

      // ── FCM missed-call notification ──────────────────────────────────────
      // Notify the callee (the person who didn't answer).
      // If customer initiated → partner was the callee → notify partner.
      // If partner initiated  → customer was the callee → notify customer.
      const calleeType = callDoc.initiatedBy === "customer" ? "partner" : "customer";
      const calleeName =
        calleeType === "partner"
          ? callDoc.partner.fullName ?? "Partner"
          : callDoc.customer.name   ?? "Customer";
      const callerName =
        calleeType === "partner"
          ? callDoc.customer.name   ?? "Customer"
          : callDoc.partner.fullName ?? "Partner";
      const calleeId =
        calleeType === "partner"
          ? callDoc.partner._id.toString()
          : callDoc.customer._id.toString();

      // Notify callee: "You missed a call from <caller>"
      sendToUser({
        userType: calleeType,
        userId:   calleeId,
        notification: {
          title: "Missed Call",
          body:  `You missed a call from ${callerName}`,
        },
        data: {
          callId,
          callerName,
          initiatedBy: callDoc.initiatedBy,
        },
        type: "missed_call",
      }).catch((err) =>
        console.error("[RingTimer] FCM missed_call (callee) push error:", err?.message || err)
      );

      // Also notify the caller: "<callee> didn't answer"
      const callerType = callDoc.initiatedBy === "customer" ? "customer" : "partner";
      const callerId   =
        callerType === "customer"
          ? callDoc.customer._id.toString()
          : callDoc.partner._id.toString();

      sendToUser({
        userType: callerType,
        userId:   callerId,
        notification: {
          title: "No Answer",
          body:  `${calleeName} didn't answer your call`,
        },
        data: {
          callId,
          calleeName,
          initiatedBy: callDoc.initiatedBy,
        },
        type: "missed_call",
      }).catch((err) =>
        console.error("[RingTimer] FCM missed_call (caller) push error:", err?.message || err)
      );
    } catch (err) {
      console.error("[RingTimer] Auto-miss error:", err.message);
    }
  }, RING_TIMEOUT_MS);

  activeRingTimers.set(callId, timeoutId);
  console.log(`[RingTimer] Started ring timer for call ${callId} (${RING_TIMEOUT_MS / 1000}s)`);
};

/**
 * stopRingTimer(callId)
 *
 * Cancels the ring timeout — call when the call is accepted, rejected,
 * or cancelled before the timeout fires.
 */
export const stopRingTimer = (callId) => {
  const timeoutId = activeRingTimers.get(callId?.toString());
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId);
    activeRingTimers.delete(callId.toString());
    console.log(`[RingTimer] Stopped ring timer for call ${callId}`);
  }
};


/**
 * In-memory store for active call timers.
 * Key: callId, Value: { intervalId, callId, customerId, partnerId, startedAt, allowedTime }
 */
const activeCallTimers = new Map();

/**
 * startCallTimer(namespace, call)
 *
 * Starts a timer for a call that has allowedTime.
 * Emits warnings at 2 min, 1 min, and 30 sec remaining.
 * Monitors wallet balances every interval and ends call if either reaches 0.
 * When time runs out, emits "call_time_exhausted" to both parties.
 *
 * @param {Namespace} namespace - Socket.IO /chat namespace
 * @param {Object} call - Call document (must have _id, customer, partner, startedAt, allowedTime)
 */
export const startCallTimer = (namespace, call) => {
  // Only time calls with allowedTime
  if (!call.allowedTime) return;

  const callId = call._id.toString();

  // Don't start duplicate timers
  if (activeCallTimers.has(callId)) return;

  const allowedMs = call.allowedTime * 1000;
  const startTime = call.startedAt ? new Date(call.startedAt).getTime() : Date.now();

  const warnings = new Set(); // Track which warnings have been sent

  const intervalId = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    const remainingMs = allowedMs - elapsed;
    const remainingSec = Math.floor(remainingMs / 1000);

    const customerRoom = `customer:${call.customer}`;
    const partnerRoom = `partner:${call.partner}`;

    // ── Check if either party has run out of balance ──────────────────────────
    // Fetch current wallet balances
    const [customerDoc, partnerDoc] = await Promise.all([
      Customer.findById(call.customer).select("walletBalance").lean(),
      Partner.findById(call.partner).select("walletBalance").lean(),
    ]);

    const customerBalance = customerDoc?.walletBalance || 0;
    const partnerBalance = partnerDoc?.walletBalance || 0;

    // If either balance is 0 or below, end the call immediately
    if (customerBalance <= 0 || partnerBalance <= 0) {
      clearInterval(intervalId);
      activeCallTimers.delete(callId);

      const insufficientParty = customerBalance <= 0 ? "customer" : "partner";

      namespace.to(customerRoom).emit("call_balance_exhausted", {
        callId,
        message: customerBalance <= 0 
          ? "Your wallet balance is insufficient. Call will end now."
          : "Partner's wallet balance is insufficient. Call will end now.",
        party: insufficientParty,
      });

      namespace.to(partnerRoom).emit("call_balance_exhausted", {
        callId,
        message: partnerBalance <= 0
          ? "Your wallet balance is insufficient. Call will end now."
          : "Customer's wallet balance is insufficient. Call will end now.",
        party: insufficientParty,
      });

      // Auto-end the call in the database
      try {
        const callDoc = await Call.findById(callId);
        if (callDoc && ["accepted", "ongoing"].includes(callDoc.status)) {
          const endTime = new Date();
          const duration = callDoc.startedAt
            ? Math.floor((endTime - callDoc.startedAt) / 1000)
            : 0;

          callDoc.status = "completed";
          callDoc.endedAt = endTime;
          callDoc.duration = duration;
          await callDoc.save();

          // Deduct wallet charges: ₹30 per minute for both customer and partner
          if (duration > 0) {
            const durationMinutes = Math.ceil(duration / 60);
            const chargePerMinute = 30;
            const totalCharge = durationMinutes * chargePerMinute;

            const { createCommunicationTransaction } = await import("../controllers/customer.wallet.controller.js");
            const { createPartnerTransaction } = await import("../controllers/partner.transaction.controller.js");

            // Deduct from customer wallet (clamped to available balance)
            const customerCharge = Math.min(totalCharge, Math.max(0, customerBalance));
            if (customerCharge > 0) {
              try {
                await createCommunicationTransaction(
                  callDoc.customer,
                  callDoc.partner,
                  "call",
                  customerCharge,
                  `Call charges - ${durationMinutes} min @ ₹${chargePerMinute}/min (balance exhausted)`
                );
              } catch (walletError) {
                console.error("[CallTimer] Customer wallet deduction error:", walletError.message);
                await Customer.findByIdAndUpdate(callDoc.customer, {
                  $inc: { walletBalance: -customerCharge },
                });
              }
            }

            // Deduct from partner wallet (clamped to available balance)
            const partnerCharge = Math.min(totalCharge, Math.max(0, partnerBalance));
            if (partnerCharge > 0) {
              try {
                await createPartnerTransaction(
                  callDoc.partner,
                  "call_charge",
                  -partnerCharge,
                  `Call charges - ${durationMinutes} min @ ₹${chargePerMinute}/min (balance exhausted)`
                );
              } catch (walletError) {
                console.error("[CallTimer] Partner wallet deduction error:", walletError.message);
                await Partner.findByIdAndUpdate(callDoc.partner, {
                  $inc: { walletBalance: -partnerCharge },
                });
              }
            }
          }

          // Emit call_ended to both parties
          namespace.to(customerRoom).emit("call_ended", {
            callId,
            duration,
            endedBy: "system",
            reason: "balance_exhausted",
            timestamp: endTime,
          });
          namespace.to(partnerRoom).emit("call_ended", {
            callId,
            duration,
            endedBy: "system",
            reason: "balance_exhausted",
            timestamp: endTime,
          });
        }
      } catch (err) {
        console.error("[CallTimer] Balance check auto-end error:", err.message);
      }
      return; // Exit interval early
    }

    // ── Regular time warnings ──────────────────────────────────────────────────
    // Warning at 2 minutes remaining
    if (remainingSec <= 120 && remainingSec > 60 && !warnings.has("2min")) {
      warnings.add("2min");
      namespace.to(customerRoom).emit("call_time_warning", {
        callId,
        remainingSeconds: remainingSec,
        message: "2 minutes remaining. Your wallet will be charged ₹30/minute.",
      });
      namespace.to(partnerRoom).emit("call_time_warning", {
        callId,
        remainingSeconds: remainingSec,
        message: "2 minutes remaining on this call.",
      });
    }

    // Warning at 1 minute remaining
    if (remainingSec <= 60 && remainingSec > 30 && !warnings.has("1min")) {
      warnings.add("1min");
      namespace.to(customerRoom).emit("call_time_warning", {
        callId,
        remainingSeconds: remainingSec,
        message: "1 minute remaining. Charges are ₹30 per minute.",
      });
      namespace.to(partnerRoom).emit("call_time_warning", {
        callId,
        remainingSeconds: remainingSec,
        message: "1 minute remaining on this call.",
      });
    }

    // Warning at 30 seconds remaining
    if (remainingSec <= 30 && remainingSec > 0 && !warnings.has("30sec")) {
      warnings.add("30sec");
      namespace.to(customerRoom).emit("call_time_warning", {
        callId,
        remainingSeconds: remainingSec,
        message: "30 seconds remaining!",
      });
      namespace.to(partnerRoom).emit("call_time_warning", {
        callId,
        remainingSeconds: remainingSec,
        message: "30 seconds remaining!",
      });
    }

    // Time exhausted — notify both parties
    if (remainingSec <= 0) {
      clearInterval(intervalId);
      activeCallTimers.delete(callId);

      namespace.to(customerRoom).emit("call_time_exhausted", {
        callId,
        message: "Your call time has ended. Charges: ₹30 per minute.",
      });

      namespace.to(partnerRoom).emit("call_time_exhausted", {
        callId,
        message: "Call time has ended.",
      });

      // Auto-end the call in the database
      try {
        const callDoc = await Call.findById(callId);
        if (callDoc && ["accepted", "ongoing"].includes(callDoc.status)) {
          const endTime = new Date();
          const duration = callDoc.startedAt
            ? Math.floor((endTime - callDoc.startedAt) / 1000)
            : 0;

          callDoc.status = "completed";
          callDoc.endedAt = endTime;
          callDoc.duration = duration;
          await callDoc.save();

          // Deduct wallet charges: ₹30 per minute for both customer and partner
          if (duration > 0) {
            const durationMinutes = Math.ceil(duration / 60); // Round up to next minute
            const chargePerMinute = 30; // ₹30 per minute
            const totalCharge = durationMinutes * chargePerMinute;

            // Import transaction helpers (dynamic import for CommonJS compatibility)
            const { createCommunicationTransaction } = await import("../controllers/customer.wallet.controller.js");
            const { createPartnerTransaction } = await import("../controllers/partner.transaction.controller.js");

            // Deduct from customer wallet
            try {
              await createCommunicationTransaction(
                callDoc.customer,
                callDoc.partner,
                "call",
                totalCharge,
                `Call charges - ${durationMinutes} min @ ₹${chargePerMinute}/min (auto-ended)`
              );
            } catch (walletError) {
              console.error("[CallTimer] Customer wallet deduction error:", walletError.message);
              // Continue even if customer wallet fails (allow negative balance)
              await Customer.findByIdAndUpdate(callDoc.customer, {
                $inc: { walletBalance: -totalCharge },
              });
            }

            // Deduct from partner wallet
            try {
              await createPartnerTransaction(
                callDoc.partner,
                "call_charge",
                -totalCharge, // Negative for deduction
                `Call charges - ${durationMinutes} min @ ₹${chargePerMinute}/min (auto-ended)`
              );
            } catch (walletError) {
              console.error("[CallTimer] Partner wallet deduction error:", walletError.message);
              // Continue even if partner wallet fails (allow negative balance)
              await Partner.findByIdAndUpdate(callDoc.partner, {
                $inc: { walletBalance: -totalCharge },
              });
            }
          }

          // Emit call_ended to both parties
          namespace.to(customerRoom).emit("call_ended", {
            callId,
            duration,
            endedBy: "system",
            reason: "time_exhausted",
            timestamp: endTime,
          });
          namespace.to(partnerRoom).emit("call_ended", {
            callId,
            duration,
            endedBy: "system",
            reason: "time_exhausted",
            timestamp: endTime,
          });
        }
      } catch (err) {
        console.error("[CallTimer] Auto-end error:", err.message);
      }
    }
  }, 5000); // Check every 5 seconds

  activeCallTimers.set(callId, {
    intervalId,
    callId,
    customerId: call.customer.toString(),
    partnerId: call.partner.toString(),
    startedAt: startTime,
    allowedTime: call.allowedTime,
  });

  console.log(`[CallTimer] Started timer for call ${callId} — ${call.allowedTime}s allowed`);
};

/**
 * stopCallTimer(callId)
 *
 * Stops the timer for a call (when it ends normally).
 */
export const stopCallTimer = (callId) => {
  const timer = activeCallTimers.get(callId);
  if (timer) {
    clearInterval(timer.intervalId);
    activeCallTimers.delete(callId);
    console.log(`[CallTimer] Stopped timer for call ${callId}`);
  }
};

/**
 * extendCallTime(namespace, callId, additionalSeconds)
 *
 * Extends the allowed time for an active call (when customer recharges mid-call).
 * Restarts the timer with the new allowed time.
 */
export const extendCallTime = async (namespace, callId, additionalSeconds) => {
  const timer = activeCallTimers.get(callId);
  if (!timer) return false;

  // Stop current timer
  clearInterval(timer.intervalId);
  activeCallTimers.delete(callId);

  // Update call in DB
  const call = await Call.findByIdAndUpdate(
    callId,
    { $inc: { allowedTime: additionalSeconds } },
    { new: true }
  );

  if (call && ["accepted", "ongoing"].includes(call.status)) {
    // Restart with updated allowedTime
    startCallTimer(namespace, call);

    // Notify customer that time was extended
    namespace.to(`customer:${call.customer}`).emit("call_time_extended", {
      callId,
      newAllowedTime: call.allowedTime,
      remainingSeconds: call.allowedTime - Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000),
      message: `${Math.floor(additionalSeconds / 60)} minutes added to your call.`,
    });

    return true;
  }

  return false;
};

/**
 * getActiveCallForCustomer(customerId)
 *
 * Returns the active call timer info for a customer (if any).
 */
export const getActiveCallForCustomer = (customerId) => {
  for (const [, timer] of activeCallTimers) {
    if (timer.customerId === customerId) {
      return timer;
    }
  }
  return null;
};
