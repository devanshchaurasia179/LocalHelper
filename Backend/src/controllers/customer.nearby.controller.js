import Customer from "../models/customer/Customer.js";
import Partner from "../models/partner/Partner.js";
import { findNearbyServices } from "../models/customer/nearby.services.js";

/**
 * GET /api/customer/services/nearby
 *
 * Location priority:
 *   1. ?lng=&lat= query params  (live GPS from app)
 *   2. Customer's saved currentLocation in DB
 *
 * Optional: ?categoryId=  ?maxRadius=
 */
export const getNearbyServices = async (req, res) => {
  try {
    let longitude, latitude;

    // ── 1. Try coordinates from query string ─────────────────────────────────
    if (req.query.lng && req.query.lat) {
      longitude = parseFloat(req.query.lng);
      latitude  = parseFloat(req.query.lat);

      if (isNaN(longitude) || isNaN(latitude)) {
        return res.status(400).json({ message: "Invalid lng/lat query parameters." });
      }
    } else {
      // ── 2. Fall back to the customer's stored currentLocation ──────────────
      const customer = await Customer.findById(req.customerId).select("currentLocation");

      if (!customer?.currentLocation?.coordinates?.length) {
        return res.status(400).json({
          message:
            "Location not available. Please allow location access in the app, or update your profile with a saved location.",
        });
      }

      [longitude, latitude] = customer.currentLocation.coordinates;
    }

    const { categoryId, maxRadius } = req.query;

    // ── Dev debug: log filter pass counts ────────────────────────────────────
    if (process.env.NODE_ENV !== "production") {
      const [total, hasLoc, approved, online, available, allReady] =
        await Promise.all([
          Partner.countDocuments(),
          Partner.countDocuments({ "serviceLocation.coordinates.0": { $exists: true } }),
          Partner.countDocuments({ verificationStatus: "Approved" }),
          Partner.countDocuments({ isOnline: true }),
          Partner.countDocuments({ isAvailable: true }),
          Partner.countDocuments({
            "serviceLocation.coordinates.0": { $exists: true },
            verificationStatus: "Approved",
            isOnline: true,
            isAvailable: true,
          }),
        ]);

      console.log(
        `🔍 Nearby [lng=${longitude}, lat=${latitude}] categoryId=${categoryId ?? "none"}`
      );
      console.log(
        `   total=${total} | hasLoc=${hasLoc} | approved=${approved} | online=${online} | available=${available} | allReady=${allReady}`
      );
    }

    const services = await findNearbyServices(longitude, latitude, {
      categoryId,
      maxRadius: maxRadius ? parseFloat(maxRadius) : undefined,
    });

    console.log(`   → ${services.length} partner(s) returned`);

    return res.status(200).json({
      count: services.length,
      coordinates: { longitude, latitude },
      services,
    });
  } catch (error) {
    console.error("getNearbyServices error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
