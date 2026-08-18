import bcrypt from "bcryptjs";
import Booking from "../models/partner/partner.booking.js";
import Partner from "../models/partner/Partner.js";
import Customer from "../models/customer/Customer.js";
import PartnerDocument from "../models/verification/PartnerDocument.js";
import PartnerTransaction from "../models/partner/partner.transaction.js";
import CustomerTransaction from "../models/customer/customer.wallet.js";

/** Generate a random 4-digit completion code string */
const generateCompletionCode = () =>
  String(Math.floor(1000 + Math.random() * 9000));

// ─── CUSTOMER: Create Booking ─────────────────────────────────────────────────
/**
 * POST /api/bookings
 * 🔒 customer_token
 *
 * Body:
 * {
 *   partnerId   : "ObjectId",
 *   categoryId  : "ObjectId",          // optional
 *   description : "Fix leaking pipe",  // optional
 *   scheduledAt : "2025-08-10T10:00:00Z",
 *   isEmergency : false,               // optional
 * }
 *
 * The customer's current address (first in addresses[]) and location are
 * snapshotted into serviceAddress at creation time.
 */
export const createBooking = async (req, res) => {
  try {
    const { partnerId, categoryId, description, scheduledAt } = req.body;

    if (!partnerId) {
      return res.status(400).json({ message: "partnerId is required." });
    }
    if (!scheduledAt) {
      return res.status(400).json({ message: "scheduledAt is required." });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
      return res.status(400).json({ message: "scheduledAt must be a valid future date." });
    }

    // Verify partner exists and is available
    const partner = await Partner.findById(partnerId).select(
      "isOnline isAvailable visitingCredits verificationStatus"
    );
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }
    if (partner.verificationStatus !== "Approved") {
      return res.status(400).json({ message: "Partner is not approved for bookings." });
    }
    if (!partner.isOnline || !partner.isAvailable) {
      return res.status(400).json({
        code: "PARTNER_OFFLINE",
        message: "This partner is currently offline. Please try again later.",
      });
    }

    // ── Check for existing active booking ─────────────────────────────────────
    // A customer cannot create a new booking if they already have one that is
    // pending, accepted, or in_progress.
    const existingActiveBooking = await Booking.findOne({
      customer: req.customerId,
      status: { $in: ["pending", "accepted", "in_progress"] },
    }).select("_id status").lean();

    if (existingActiveBooking) {
      return res.status(400).json({
        code: "ACTIVE_BOOKING_EXISTS",
        message: `You already have a ${existingActiveBooking.status} booking. Please complete or cancel it before creating a new one.`,
        existingBookingId: existingActiveBooking._id,
      });
    }

    // Load customer for address snapshot
    const customer = await Customer.findById(req.customerId).select(
      "addresses currentLocation walletBalance"
    );
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    // ── Wallet balance check ──────────────────────────────────────────────────
    const bookingCost = partner.visitingCredits?.amount ?? 0;
    if (bookingCost > 0 && customer.walletBalance < bookingCost) {
      return res.status(400).json({
        code: "INSUFFICIENT_BALANCE",
        message: `Insufficient wallet balance. Required: ₹${bookingCost}, Available: ₹${customer.walletBalance}.`,
      });
    }

    // Snapshot the first saved address (if any)
    const addr = customer.addresses?.[0];
    const serviceAddress = addr
      ? {
          house:    addr.house,
          street:   addr.street,
          locality: addr.locality,
          city:     addr.city,
          state:    addr.state,
          pincode:  addr.pincode,
          // Embed GeoJSON if customer has a current location
          ...(customer.currentLocation?.coordinates?.length === 2 && {
            coordinates: {
              type:        "Point",
              coordinates: customer.currentLocation.coordinates,
            },
          }),
        }
      : undefined;

    const booking = await Booking.create({
      partner:        partnerId,
      customer:       req.customerId,
      category:       categoryId  || undefined,
      description:    description || undefined,
      scheduledAt:    scheduledDate,
      visitingCredit: partner.visitingCredits?.amount,
      serviceAddress,
      status:         "pending",
    });

    // ── Deduct booking cost from customer wallet ───────────────────────────
    if (bookingCost > 0) {
      const newBalance = customer.walletBalance - bookingCost;

      await CustomerTransaction.create({
        customer:     req.customerId,
        type:         "booking",
        amount:       bookingCost,
        direction:    "debit",
        balanceAfter: newBalance,
        status:       "completed",
        booking:      booking._id,
        description:  `Booking payment to partner`,
      });

      await Customer.findByIdAndUpdate(req.customerId, {
        $inc: { walletBalance: -bookingCost },
      });
    }

    return res.status(201).json({
      message: "Booking created successfully.",
      booking: {
        id:             booking._id,
        status:         booking.status,
        scheduledAt:    booking.scheduledAt,
        visitingCredit: booking.visitingCredit,
      },
    });
  } catch (error) {
    console.error("createBooking error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── PARTNER: Accept Booking ──────────────────────────────────────────────────
/**
 * PATCH /api/bookings/:id/accept
 * 🔒 partner_token
 *
 * Transitions: pending → accepted
 */
export const acceptBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }
    if (booking.partner.toString() !== req.partnerId) {
      return res.status(403).json({ message: "Not authorised to act on this booking." });
    }
    if (booking.status !== "pending") {
      return res.status(400).json({
        message: `Cannot accept a booking with status "${booking.status}".`,
      });
    }

    // Generate a 4-digit completion code — stored hashed, plain code returned
    // to the customer via their booking detail screen.
    const code      = generateCompletionCode();
    const salt      = await bcrypt.genSalt(10);
    const hash      = await bcrypt.hash(code, salt);

    booking.status         = "accepted";
    booking.completionCode = { code, hash };
    await booking.save();

    return res.status(200).json({
      message: "Booking accepted.",
      booking: { id: booking._id, status: booking.status },
    });
  } catch (error) {
    console.error("acceptBooking error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── PARTNER: Start Booking ───────────────────────────────────────────────────
/**
 * PATCH /api/bookings/:id/start
 * 🔒 partner_token
 *
 * Transitions: accepted → in_progress
 */
export const startBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }
    if (booking.partner.toString() !== req.partnerId) {
      return res.status(403).json({ message: "Not authorised to act on this booking." });
    }
    if (booking.status !== "accepted") {
      return res.status(400).json({
        message: `Cannot start a booking with status "${booking.status}".`,
      });
    }

    booking.status    = "in_progress";
    booking.startedAt = new Date();
    await booking.save();

    return res.status(200).json({
      message: "Booking started.",
      booking: { id: booking._id, status: booking.status, startedAt: booking.startedAt },
    });
  } catch (error) {
    console.error("startBooking error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── PARTNER: Complete Booking ────────────────────────────────────────────────
/**
 * PATCH /api/bookings/:id/complete
 * 🔒 partner_token
 *
 * Transitions: in_progress → completed
 * Also increments partner.completedJobs and partner.totalEarnings.
 */
export const completeBooking = async (req, res) => {
  try {
    const { completionCode } = req.body;

    if (!completionCode) {
      return res.status(400).json({
        message: "completionCode is required. Ask the customer for their 4-digit code.",
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }
    if (booking.partner.toString() !== req.partnerId) {
      return res.status(403).json({ message: "Not authorised to act on this booking." });
    }
    if (booking.status !== "in_progress") {
      return res.status(400).json({
        message: `Cannot complete a booking with status "${booking.status}".`,
      });
    }

    // ── Validate completion code ─────────────────────────────────────────────
    if (!booking.completionCode?.hash) {
      return res.status(400).json({
        message: "No completion code found for this booking.",
      });
    }
    const isCodeValid = await bcrypt.compare(
      String(completionCode),
      booking.completionCode.hash
    );
    if (!isCodeValid) {
      return res.status(400).json({ message: "Invalid completion code." });
    }

    booking.status         = "completed";
    booking.completedAt    = new Date();
    booking.completionCode = undefined; // clear the code — it's single-use
    await booking.save();

    // Update partner stats atomically
    const updatedPartner = await Partner.findByIdAndUpdate(
      req.partnerId,
      {
        $inc: {
          completedJobs: 1,
          totalEarnings: booking.visitingCredit ?? 0,
          walletBalance: booking.visitingCredit ?? 0,
        },
      },
      { new: true, select: "walletBalance" }
    );

    // ── Record earning transaction ────────────────────────────────────────
    // Creates an immutable audit entry for this booking's payout.
    if (booking.visitingCredit && booking.visitingCredit > 0) {
      await PartnerTransaction.create({
        partner:      req.partnerId,
        type:         "earning",
        amount:       booking.visitingCredit,
        direction:    "credit",
        balanceAfter: updatedPartner?.walletBalance ?? 0,
        status:       "completed",
        booking:      booking._id,
        description:  `Earning from booking #${booking._id}`,
      });
    }

    return res.status(200).json({
      message: "Booking completed.",
      booking: {
        id:          booking._id,
        status:      booking.status,
        startedAt:   booking.startedAt,
        completedAt: booking.completedAt,
      },
    });
  } catch (error) {
    console.error("completeBooking error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── CANCEL Booking (partner OR customer) ────────────────────────────────────
/**
 * PATCH /api/bookings/:id/cancel
 * 🔒 partner_token  OR  customer_token
 *
 * Body: { reason }  (optional)
 *
 * Rules:
 *  - Customer can cancel when status is pending or accepted.
 *  - Partner  can cancel when status is pending or accepted.
 *  - Neither  can cancel an in_progress or completed booking.
 *
 * The caller is identified by which cookie is present on the request.
 * req.partnerId OR req.customerId must be set by the auth middleware.
 */
export const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;

    // Determine who is cancelling based on which ID was set by the middleware.
    // If both are present (shared cookie jar in dev), prefer customerId when
    // the booking belongs to that customer, and partnerId when it belongs to
    // that partner. This avoids mis-attribution.
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // Determine caller identity — resolve ambiguity when both IDs are present
    let isPartner  = false;
    let cancelledBy = "customer";
    let callerId   = req.customerId;

    if (req.partnerId && booking.partner.toString() === req.partnerId) {
      isPartner   = true;
      cancelledBy = "partner";
      callerId    = req.partnerId;
    } else if (req.customerId && booking.customer.toString() === req.customerId) {
      isPartner   = false;
      cancelledBy = "customer";
      callerId    = req.customerId;
    } else if (req.partnerId && !req.customerId) {
      // Only partner token present
      isPartner   = true;
      cancelledBy = "partner";
      callerId    = req.partnerId;
    } else if (req.customerId && !req.partnerId) {
      // Only customer token present
      isPartner   = false;
      cancelledBy = "customer";
      callerId    = req.customerId;
    } else {
      return res.status(403).json({ message: "Not authorised to cancel this booking." });
    }

    // Ownership check
    const ownerField = isPartner ? booking.partner : booking.customer;
    if (ownerField.toString() !== callerId) {
      return res.status(403).json({ message: "Not authorised to cancel this booking." });
    }

    if (!["pending", "accepted"].includes(booking.status)) {
      return res.status(400).json({
        message: `Cannot cancel a booking with status "${booking.status}".`,
      });
    }

    booking.status       = "cancelled";
    booking.cancellation = {
      cancelledBy,
      reason:      reason?.trim() || undefined,
      cancelledAt: new Date(),
    };
    await booking.save();

    // Increment partner's cancelled job counter
    await Partner.findByIdAndUpdate(booking.partner, {
      $inc: { cancelledJobs: 1 },
    });

    // ── Refund visiting credit to customer wallet ──────────────────────────
    const refundAmount = booking.visitingCredit ?? 0;
    if (refundAmount > 0) {
      const customer = await Customer.findByIdAndUpdate(
        booking.customer,
        { $inc: { walletBalance: refundAmount } },
        { new: true, select: "walletBalance" }
      );

      await CustomerTransaction.create({
        customer:     booking.customer,
        type:         "refund",
        amount:       refundAmount,
        direction:    "credit",
        balanceAfter: customer.walletBalance,
        status:       "completed",
        booking:      booking._id,
        description:  `Refund for cancelled booking`,
      });
    }

    return res.status(200).json({
      message: "Booking cancelled.",
      booking: {
        id:           booking._id,
        status:       booking.status,
        cancellation: booking.cancellation,
      },
    });
  } catch (error) {
    console.error("cancelBooking error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── CUSTOMER: Leave a Review ─────────────────────────────────────────────────
/**
 * POST /api/bookings/:id/review
 * 🔒 customer_token
 *
 * Body: { rating, comment }
 * Only allowed after booking is completed and not already reviewed.
 * Also updates partner.averageRating and partner.totalReviews.
 */
export const reviewBooking = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5." });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }
    if (booking.customer.toString() !== req.customerId) {
      return res.status(403).json({ message: "Not authorised to review this booking." });
    }
    if (booking.status !== "completed") {
      return res.status(400).json({ message: "You can only review a completed booking." });
    }
    if (booking.review?.rating) {
      return res.status(400).json({ message: "This booking has already been reviewed." });
    }

    booking.review = {
      rating,
      comment: comment?.trim() || undefined,
      createdAt: new Date(),
    };
    await booking.save();

    // Recalculate partner's average rating atomically
    const partner = await Partner.findById(booking.partner).select(
      "averageRating totalReviews"
    );
    if (partner) {
      const newTotal = partner.totalReviews + 1;
      const newAvg   = parseFloat(
        ((partner.averageRating * partner.totalReviews + rating) / newTotal).toFixed(2)
      );
      partner.averageRating = newAvg;
      partner.totalReviews  = newTotal;
      await partner.save();
    }

    return res.status(200).json({
      message: "Review submitted.",
      review: booking.review,
    });
  } catch (error) {
    console.error("reviewBooking error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── PUBLIC: Get Partner Reviews ─────────────────────────────────────────────
/**
 * GET /api/bookings/partners/:partnerId/reviews
 * 🔓 public
 *
 * Query params:
 *   page  : number (default 1)
 *   limit : number (default 20)
 *
 * Returns all completed bookings for the partner that have a review,
 * sorted newest first.
 */
export const getPartnerReviews = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const filter = {
      partner: partnerId,
      status:  "completed",
      "review.rating": { $exists: true },
    };

    const [reviews, total] = await Promise.all([
      Booking.find(filter)
        .sort({ "review.createdAt": -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("customer", "fullName profilePhoto")
        .select("review customer completedAt"),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      reviews: reviews.map((b) => ({
        bookingId:   b._id,
        rating:      b.review.rating,
        comment:     b.review.comment ?? null,
        reviewedAt:  b.review.createdAt,
        completedAt: b.completedAt,
        customer: {
          id:           b.customer?._id,
          fullName:     b.customer?.fullName,
          profilePhoto: b.customer?.profilePhoto,
        },
      })),
      pagination: {
        total,
        page:       Number(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getPartnerReviews error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── PARTNER: Get Bookings ────────────────────────────────────────────────────
/**
 * GET /api/bookings/partner
 * 🔒 partner_token
 *
 * Query params:
 *   status  : "pending" | "accepted" | "in_progress" | "completed" | "cancelled"
 *   page    : number (default 1)
 *   limit   : number (default 20)
 */
export const getPartnerBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { partner: req.partnerId };
    if (status) filter.status = status;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("customer",  "name phone")
        .populate("category",  "name"),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      bookings,
      pagination: {
        total,
        page:       Number(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getPartnerBookings error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── CUSTOMER: Get Bookings ───────────────────────────────────────────────────
/**
 * GET /api/bookings/customer
 * 🔒 customer_token
 *
 * Query params: status, page, limit
 */
export const getCustomerBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { customer: req.customerId };
    if (status) filter.status = status;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("partner",  "fullName phone profilePhoto selfie averageRating visitingCredits")
        .populate("category", "name"),
      Booking.countDocuments(filter),
    ]);

    // ── Attach selfie URL — dual-system lookup ────────────────────────────────
    // New system: PartnerDocument collection (documentTypeId = selfie type)
    // Old system: partner.selfie.url (stored directly on Partner via submitKyc)
    const SELFIE_TYPE_ID = "6a71da429e8965def7e6ba4f";

    const partnerIds = [...new Set(bookings.map((b) => b.partner?._id).filter(Boolean))];

    let selfieMap = {};
    if (partnerIds.length > 0) {
      // 1. New system: approved PartnerDocument records
      const selfieDocs = await PartnerDocument.find({
        partnerId:      { $in: partnerIds },
        documentTypeId: SELFIE_TYPE_ID,
        status:         "Approved",
      })
        .sort({ version: -1 })
        .select("partnerId cloudinaryFiles")
        .lean();

      for (const doc of selfieDocs) {
        const pid = doc.partnerId.toString();
        if (!selfieMap[pid]) {
          // cloudinaryFiles[0].url — use array directly (virtual not available in lean)
          selfieMap[pid] = doc.cloudinaryFiles?.[0]?.url ?? null;
        }
      }

      // 2. Old system: partner.selfie.url — fill gaps for partners not in new system
      const missingIds = partnerIds.filter((id) => !selfieMap[id?.toString()]);
      if (missingIds.length > 0) {
        const oldPartners = await Partner.find({ _id: { $in: missingIds } })
          .select("selfie profilePhoto")
          .lean();
        for (const p of oldPartners) {
          const pid = p._id.toString();
          selfieMap[pid] = p.selfie?.url ?? p.profilePhoto ?? null;
        }
      }
    }

    // Serialize bookings with selfieUrl injected into partner
    // Also expose completionCode.code to the customer (strip hash)
    const enrichedBookings = bookings.map((b) => {
      const obj = b.toObject();
      if (obj.partner) {
        obj.partner.selfieUrl = selfieMap[obj.partner._id?.toString()] ?? null;
        delete obj.partner.selfie; // don't expose raw selfie field
      }
      // Show the plain code to the customer; never expose the hash
      if (obj.completionCode) {
        obj.completionCode = { code: obj.completionCode.code ?? null };
      }
      return obj;
    });

    return res.status(200).json({
      bookings: enrichedBookings,
      pagination: {
        total,
        page:       Number(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getCustomerBookings error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET Single Booking ───────────────────────────────────────────────────────
/**
 * GET /api/bookings/:id
 * 🔒 partner_token  OR  customer_token
 *
 * Both the partner and the customer on the booking can view it.
 */
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("partner",  "fullName phone profilePhoto selfie averageRating")
      .populate("customer", "name phone")
      .populate("category", "name");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    const callerId = req.partnerId ?? req.customerId;
    const isOwner  =
      booking.partner._id.toString()  === callerId ||
      booking.customer._id.toString() === callerId;

    if (!isOwner) {
      return res.status(403).json({ message: "Not authorised to view this booking." });
    }

    // Resolve selfieUrl using the same dual-system priority as getCustomerBookings
    const SELFIE_TYPE_ID = "6a71da429e8965def7e6ba4f";
    const partnerId = booking.partner._id;

    const selfieDoc = await PartnerDocument.findOne({
      partnerId:      partnerId,
      documentTypeId: SELFIE_TYPE_ID,
      status:         "Approved",
    })
      .sort({ version: -1 })
      .select("cloudinaryFiles")
      .lean();

    const obj = booking.toObject();
    obj.partner.selfieUrl =
      selfieDoc?.cloudinaryFiles?.[0]?.url          // new system
      ?? obj.partner.selfie?.url                    // old system
      ?? obj.partner.profilePhoto                   // profile photo fallback
      ?? null;

    // Don't expose the raw selfie field to the client
    delete obj.partner.selfie;

    // Completion code visibility:
    //   - Customer → sees the plain code (to read out to the partner)
    //   - Partner  → sees nothing (they enter the code, not read it)
    if (obj.completionCode) {
      if (req.customerId && booking.customer._id.toString() === req.customerId) {
        obj.completionCode = { code: obj.completionCode.code ?? null };
      } else {
        delete obj.completionCode;
      }
    }

    return res.status(200).json({ booking: obj });
  } catch (error) {
    console.error("getBookingById error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── CUSTOMER: Initiate Chat ──────────────────────────────────────────────────
/**
 * POST /api/bookings/chat/:partnerId
 * 🔒 customer_token
 *
 * Deducts the partner's chatCharges from the customer's wallet and records
 * a "chat" transaction. Call this once before opening a chat session.
 *
 * Returns the updated wallet balance so the client can reflect it immediately.
 */
export const initiateChat = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const [partner, customer] = await Promise.all([
      Partner.findById(partnerId).select("chatCharges verificationStatus isOnline"),
      Customer.findById(req.customerId).select("walletBalance"),
    ]);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }
    if (partner.verificationStatus !== "Approved") {
      return res.status(400).json({ message: "Partner is not available for chat." });
    }
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const charge = partner.chatCharges ?? 0;

    if (charge > 0 && customer.walletBalance < charge) {
      return res.status(400).json({
        code:    "INSUFFICIENT_BALANCE",
        message: `Insufficient wallet balance. Required: ₹${charge}, Available: ₹${customer.walletBalance}.`,
      });
    }

    const newBalance = customer.walletBalance - charge;

    // Deduct and record in a single logical block
    if (charge > 0) {
      await CustomerTransaction.create({
        customer:     req.customerId,
        type:         "chat",
        amount:       charge,
        direction:    "debit",
        balanceAfter: newBalance,
        status:       "completed",
        description:  `Chat charges`,
      });

      await Customer.findByIdAndUpdate(req.customerId, {
        $inc: { walletBalance: -charge },
      });
    }

    return res.status(200).json({
      message:        charge > 0 ? `₹${charge} deducted for chat.` : "Chat initiated.",
      charge,
      walletBalance:  newBalance,
    });
  } catch (error) {
    console.error("initiateChat error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── CUSTOMER: Initiate Call ──────────────────────────────────────────────────
/**
 * POST /api/bookings/call/:partnerId
 * 🔒 customer_token
 *
 * Deducts the partner's callCharges from the customer's wallet and records
 * a "call" transaction. Call this once before connecting a call.
 *
 * Returns the updated wallet balance so the client can reflect it immediately.
 */
export const initiateCall = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const [partner, customer] = await Promise.all([
      Partner.findById(partnerId).select("callCharges verificationStatus isOnline"),
      Customer.findById(req.customerId).select("walletBalance"),
    ]);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }
    if (partner.verificationStatus !== "Approved") {
      return res.status(400).json({ message: "Partner is not available for calls." });
    }
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const charge = partner.callCharges?.amount ?? 0;
    const durationMinutes = partner.callCharges?.durationMinutes ?? 10;

    if (charge > 0 && customer.walletBalance < charge) {
      return res.status(400).json({
        code:    "INSUFFICIENT_BALANCE",
        message: `Insufficient wallet balance. Required: ₹${charge}, Available: ₹${customer.walletBalance}.`,
      });
    }

    const newBalance = customer.walletBalance - charge;

    // Deduct and record in a single logical block
    if (charge > 0) {
      await CustomerTransaction.create({
        customer:     req.customerId,
        type:         "call",
        amount:       charge,
        direction:    "debit",
        balanceAfter: newBalance,
        status:       "completed",
        description:  `Call charges (₹${charge} / ${durationMinutes} min)`,
      });

      await Customer.findByIdAndUpdate(req.customerId, {
        $inc: { walletBalance: -charge },
      });
    }

    return res.status(200).json({
      message:         charge > 0 ? `₹${charge} deducted for call.` : "Call initiated.",
      charge,
      durationMinutes,
      walletBalance:   newBalance,
    });
  } catch (error) {
    console.error("initiateCall error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
