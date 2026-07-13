import Booking from "../models/partner/partner.booking.js";
import Partner from "../models/partner/Partner.js";
import Customer from "../models/customer/Customer.js";

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
    const { partnerId, categoryId, description, scheduledAt, isEmergency } = req.body;

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
      return res.status(400).json({ message: "Partner is currently unavailable." });
    }

    // Load customer for address snapshot
    const customer = await Customer.findById(req.customerId).select(
      "addresses currentLocation"
    );
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
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
      visitingCredit: partner.visitingCredits,
      isEmergency:    isEmergency ?? false,
      serviceAddress,
      status:         "pending",
    });

    return res.status(201).json({
      message: "Booking created successfully.",
      booking: {
        id:             booking._id,
        status:         booking.status,
        scheduledAt:    booking.scheduledAt,
        visitingCredit: booking.visitingCredit,
        isEmergency:    booking.isEmergency,
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

    booking.status = "accepted";
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

    booking.status      = "completed";
    booking.completedAt = new Date();
    await booking.save();

    // Update partner stats atomically
    await Partner.findByIdAndUpdate(req.partnerId, {
      $inc: {
        completedJobs:  1,
        totalEarnings:  booking.visitingCredit ?? 0,
        walletBalance:  booking.visitingCredit ?? 0,
      },
    });

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
 * The route is mounted twice — once under /partner and once under /customer.
 */
export const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;

    // Determine who is cancelling
    const isPartner  = !!req.partnerId;
    const cancelledBy = isPartner ? "partner" : "customer";
    const callerId    = isPartner ? req.partnerId : req.customerId;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
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
        .populate("partner",  "fullName phone profilePhoto averageRating visitingCredits")
        .populate("category", "name"),
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
      .populate("partner",  "fullName phone profilePhoto")
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

    return res.status(200).json({ booking });
  } catch (error) {
    console.error("getBookingById error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
