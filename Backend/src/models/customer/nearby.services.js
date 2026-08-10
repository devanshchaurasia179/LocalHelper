import mongoose from "mongoose";
import Partner from "../partner/Partner.js";

/**
 * Find partners whose serviceLocation is within their declared serviceRadius
 * of the given customer coordinates.
 *
 * Filters:
 *   - serviceLocation has coordinates (index element 0 exists)
 *   - verificationStatus === "Approved"
 *   - distanceKm <= partner's own serviceRadius
 *
 * @param {number} longitude
 * @param {number} latitude
 * @param {object} [filters]
 * @param {string} [filters.categoryId]
 * @param {number} [filters.maxRadius]  – km, default 50
 */
export async function findNearbyServices(longitude, latitude, filters = {}) {
  const { categoryId, maxRadius = 50 } = filters;

  // Profile-picture document type ID (key: "selfie").
  // Using the known _id directly avoids an extra DocumentType round-trip on
  // every nearby-services request.
  const selfieTypeId = new mongoose.Types.ObjectId("6a71da429e8965def7e6ba4f");

  const pipeline = [
    // ── Stage 1: geo filter ──────────────────────────────────────────────────
    {
      $geoNear: {
        near: { type: "Point", coordinates: [longitude, latitude] },
        distanceField: "distanceKm",
        distanceMultiplier: 0.001,        // metres → km
        maxDistance: maxRadius * 1000,    // metres
        spherical: true,
        query: {
          // Check index 0 exists — more reliable than $ne:[]
          "serviceLocation.coordinates.0": { $exists: true },
          verificationStatus: "Approved",
        },
      },
    },

    // ── Stage 2: only partners whose serviceRadius covers the customer ────────
    {
      $match: {
        $expr: { $lte: ["$distanceKm", "$serviceRadius"] },
      },
    },

    // ── Stage 3: optional category filter ────────────────────────────────────
    ...(categoryId
      ? [{ $match: { categories: new mongoose.Types.ObjectId(categoryId) } }]
      : []),

    // ── Stage 4: populate category names ─────────────────────────────────────
    {
      $lookup: {
        from: "categories",
        localField: "categories",
        foreignField: "_id",
        as: "categories",
      },
    },

    // ── Stage 4b: lookup profile picture from partnerdocuments (new system) ──
    // Falls back to partner.selfie.url (old KYC system) when no PartnerDocument
    // record exists — covers partners who uploaded via the old submitKyc flow.
    {
      $lookup: {
        from: "partnerdocuments",
        let: { pid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$partnerId", "$$pid"] },
              documentTypeId: selfieTypeId,
              status: "Approved",
            },
          },
          { $sort: { version: -1 } },
          { $limit: 1 },
          { $project: { _id: 0, url: { $arrayElemAt: ["$cloudinaryFiles.url", 0] } } },
        ],
        as: "_selfie",
      },
    },
    {
      $addFields: {
        // 1st priority: approved PartnerDocument (new verification system)
        // 2nd priority: partner.selfie.url (old submitKyc system)
        // 3rd priority: partner.profilePhoto (profile-setup field)
        selfieUrl: {
          $ifNull: [
            { $arrayElemAt: ["$_selfie.url", 0] },
            { $ifNull: ["$selfie.url", "$profilePhoto"] },
          ],
        },
      },
    },
    { $project: { _selfie: 0 } },

    // ── Stage 5: shape response ───────────────────────────────────────────────
    {
      $project: {
        fullName: 1,
        profilePhoto: 1,
        selfieUrl: 1,
        bio: 1,
        categories: 1,
        experience: 1,
        languages: 1,
        visitingCredits: 1,
        emergencyAvailable: 1,
        isOnline: 1,
        isAvailable: 1,
        workingDays: 1,
        serviceLocation: 1,
        serviceRadius: 1,
        distanceKm: 1,
        averageRating: 1,
        totalReviews: 1,
        completedJobs: 1,
        // selfie and profilePhoto are excluded here — already resolved into selfieUrl
      },
    },

    // ── Stage 6: nearest first ────────────────────────────────────────────────
    { $sort: { distanceKm: 1 } },
  ];

  return Partner.aggregate(pipeline);
}
