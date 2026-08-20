import Call from "../models/call/call.js";
import Customer from "../models/customer/Customer.js";
import Partner from "../models/partner/Partner.js";

/**
 * In-memory store for active call timers.
 * Key: callId, Value: { intervalId, callId, customerId, partnerId, startedAt, allowedTime }
 */
const activeCallTimers = new Map();

/**
 * startCallTimer(namespace, call)
 *
 * Starts a timer for a customer-initiated call that has allowedTime.
 * Emits warnings at 2 min, 1 min, and 30 sec remaining.
 * When time runs out, emits "call_time_exhausted" to both parties.
 *
 * @param {Namespace} namespace - Socket.IO /chat namespace
 * @param {Object} call - Call document (must have _id, customer, partner, startedAt, allowedTime)
 */
export const startCallTimer = (namespace, call) => {
  // Only time customer-initiated calls with allowedTime
  if (!call.allowedTime || call.initiatedBy !== "customer") return;

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

    // Warning at 2 minutes remaining
    if (remainingSec <= 120 && remainingSec > 60 && !warnings.has("2min")) {
      warnings.add("2min");
      namespace.to(customerRoom).emit("call_time_warning", {
        callId,
        remainingSeconds: remainingSec,
        message: "2 minutes remaining. Please recharge to continue.",
      });
    }

    // Warning at 1 minute remaining
    if (remainingSec <= 60 && remainingSec > 30 && !warnings.has("1min")) {
      warnings.add("1min");
      namespace.to(customerRoom).emit("call_time_warning", {
        callId,
        remainingSeconds: remainingSec,
        message: "1 minute remaining. Recharge now to avoid disconnection.",
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
    }

    // Time exhausted — notify both parties
    if (remainingSec <= 0) {
      clearInterval(intervalId);
      activeCallTimers.delete(callId);

      namespace.to(customerRoom).emit("call_time_exhausted", {
        callId,
        message: "Your call time has ended. Please recharge to make more calls.",
      });

      namespace.to(partnerRoom).emit("call_time_exhausted", {
        callId,
        message: "Customer's call time has ended.",
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

          // Deduct callBalance only for recharge-based model (no partner callCharges)
          if (duration > 0) {
            const partnerDoc = await Partner.findById(callDoc.partner).select("callCharges");
            const isPrePaid = (partnerDoc?.callCharges?.amount ?? 0) > 0;

            if (!isPrePaid) {
              const deductSeconds = Math.min(duration, callDoc.allowedTime || duration);
              const customerDoc = await Customer.findById(callDoc.customer).select("callBalance");
              const currentBalance = customerDoc?.callBalance || 0;
              const actualDeduct = Math.min(deductSeconds, currentBalance);
              if (actualDeduct > 0) {
                await Customer.findByIdAndUpdate(callDoc.customer, {
                  $inc: { callBalance: -actualDeduct },
                });
              }
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
