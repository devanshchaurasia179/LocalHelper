import Partner from "../models/partner/Partner.js";
import Booking from "../models/partner/partner.booking.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

const validateWorkingDays = (workingDays) => {
  for (const entry of workingDays) {
    if (!VALID_DAYS.includes(entry.day)) {
      return `Invalid day "${entry.day}". Must be one of: ${VALID_DAYS.join(", ")}`;
    }
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(entry.startTime) || !timeRegex.test(entry.endTime)) {
      return `Invalid time format for ${entry.day}. Use HH:MM (24-hour).`;
    }
  }
  return null;
};

// ─── SET SERVICE DETAILS ─────────────────────────────────────────────────────
/**
 * PUT /api/partner/service/setup
 * 🔒 Requires partner_token cookie
 *
 * Body:
 * {
 *   categories        : ["categoryId1", "categoryId2"],
 *   skills            : ["Plumbing", "Pipe Fitting"],
 *   experience        : 4,
 *   languages         : ["Hindi", "English"],
 *   bio               : "Short description",
 *   visitingCredits   : 150,    // ₹ charged for visiting the customer
 *   emergencyAvailable: true,
 *   serviceRadius     : 15,     // km
 *   serviceLocation   : { longitude: 77.2090, latitude: 28.6139 },
 *   workingDays: [
 *     { day: "Monday", startTime: "09:00", endTime: "18:00" }
 *   ]
 * }
 *
 * Required: categories, skills, visitingCredits, serviceLocation
 */
export const setupService = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (!partner.verification.phoneVerified) {
      return res.status(403).json({
        message: "Complete phone verification before setting up services.",
      });
    }

    const {
      categories,
      skills,
      experience,
      languages,
      bio,
      visitingCredits,
      emergencyAvailable,
      serviceRadius,
      serviceLocation,
      workingDays,
    } = req.body;

    // ── Required field checks ─────────────────────────────────────────────
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: "At least one category is required." });
    }
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ message: "At least one skill is required." });
    }
    if (visitingCredits === undefined || visitingCredits === null) {
      return res.status(400).json({ message: "visitingCredits is required." });
    }
    if (typeof visitingCredits !== "number" || visitingCredits < 0) {
      return res.status(400).json({ message: "visitingCredits must be a non-negative number." });
    }

    // ── Validate workingDays if provided ──────────────────────────────────
    if (workingDays && Array.isArray(workingDays) && workingDays.length > 0) {
      const dayError = validateWorkingDays(workingDays);
      if (dayError) {
        return res.status(400).json({ message: dayError });
      }
    }

    // ── Map & save ────────────────────────────────────────────────────────
    partner.categories      = categories;
    partner.skills          = skills;
    partner.experience      = experience      ?? partner.experience;
    partner.languages       = languages       ?? partner.languages;
    partner.bio             = bio             ?? partner.bio;
    partner.visitingCredits = visitingCredits;
    partner.emergencyAvailable = emergencyAvailable ?? false;
    partner.serviceRadius   = serviceRadius   ?? 10;

    if (serviceLocation?.longitude && serviceLocation?.latitude) {
      partner.serviceLocation = {
        type: "Point",
        coordinates: [serviceLocation.longitude, serviceLocation.latitude],
      };
    }

    if (workingDays && workingDays.length > 0) {
      partner.workingDays = workingDays;
    }

    partner.isService = true;
    await partner.save();

    return res.status(200).json({
      message: "Service details saved successfully.",
      service: {
        categories:         partner.categories,
        skills:             partner.skills,
        experience:         partner.experience,
        languages:          partner.languages,
        bio:                partner.bio,
        visitingCredits:    partner.visitingCredits,
        emergencyAvailable: partner.emergencyAvailable,
        serviceRadius:      partner.serviceRadius,
        serviceLocation:    partner.serviceLocation,
        workingDays:        partner.workingDays,
      },
    });
  } catch (error) {
    console.error("setupService error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET SERVICE DETAILS ─────────────────────────────────────────────────────
/**
 * GET /api/partner/service
 * 🔒 Requires partner_token cookie
 */
export const getServiceDetails = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId)
      .select(
        "categories skills experience languages bio visitingCredits emergencyAvailable serviceRadius serviceLocation workingDays isAvailable isOnline"
      )
      .populate("categories", "name");

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    return res.status(200).json({ service: partner });
  } catch (error) {
    console.error("getServiceDetails error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── UPDATE AVAILABILITY ─────────────────────────────────────────────────────
/**
 * PATCH /api/partner/service/availability
 * 🔒 Requires partner_token cookie
 *
 * Body: { isOnline, isAvailable }
 */
export const updateAvailability = async (req, res) => {
  try {
    const { isOnline, isAvailable } = req.body;

    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (isOnline    !== undefined) partner.isOnline    = isOnline;
    if (isAvailable !== undefined) partner.isAvailable = isAvailable;

    await partner.save();

    return res.status(200).json({
      message:     "Availability updated.",
      isOnline:    partner.isOnline,
      isAvailable: partner.isAvailable,
    });
  } catch (error) {
    console.error("updateAvailability error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── UPDATE VISITING CREDITS ──────────────────────────────────────────────────
/**
 * PATCH /api/partner/service/visiting-credits
 * 🔒 Requires partner_token cookie
 *
 * Body: { visitingCredits }
 * Quick update for visiting credits without full service re-submission.
 */
export const updateVisitingCredits = async (req, res) => {
  try {
    const { visitingCredits } = req.body;

    if (visitingCredits === undefined || visitingCredits === null) {
      return res.status(400).json({ message: "visitingCredits is required." });
    }
    if (typeof visitingCredits !== "number" || visitingCredits < 0) {
      return res.status(400).json({ message: "visitingCredits must be a non-negative number." });
    }

    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    partner.visitingCredits = visitingCredits;
    await partner.save();

    return res.status(200).json({
      message:         "Visiting credits updated.",
      visitingCredits: partner.visitingCredits,
    });
  } catch (error) {
    console.error("updateVisitingCredits error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
/**
 * GET /api/partner/service/dashboard
 * 🔒 Requires partner_token cookie
 *
 * Returns quick stats for the partner's home screen:
 * - todayBookings: count of bookings scheduled today
 * - totalEarnings: lifetime earnings
 * - averageRating: current average rating
 * - completedJobs: total completed jobs
 */
export const getDashboardStats = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId).select(
      "averageRating totalReviews completedJobs totalEarnings walletBalance"
    );

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    // Count bookings scheduled for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayBookings = await Booking.countDocuments({
      partner: req.partnerId,
      status: { $in: ["pending", "accepted", "in_progress"] },
      scheduledAt: { $gte: startOfDay, $lte: endOfDay },
    });

    return res.status(200).json({
      todayBookings,
      totalEarnings: partner.totalEarnings ?? 0,
      walletBalance: partner.walletBalance ?? 0,
      averageRating: partner.averageRating ?? 0,
      totalReviews: partner.totalReviews ?? 0,
      completedJobs: partner.completedJobs ?? 0,
    });
  } catch (error) {
    console.error("getDashboardStats error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
