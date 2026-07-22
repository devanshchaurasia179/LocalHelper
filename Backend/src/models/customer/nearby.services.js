import mongoose from "mongoose";
import Partner from "../partner/Partner.js";
import DocumentType from "../verification/DocumentType.js";

/**
 * Find partners whose serviceLocation is within their declared serviceRadius
 * of the given customer coordinates.
 *
 * Filters:
 *   - serviceLocation has coordinates (index element 0 exists)
 *   - verificationStatus === "Approved"
 *   - isOnline  === true
 *   - isAvailable === true
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

  // Fetch the selfie DocumentType _id once (cached by Mongoose after first call)
  const selfieType = await DocumentType.findOne({ key: "selfie" }).select("_id").lean();
  const selfieTypeId = selfieType?._id;

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

    // ── Stage 4b: lookup selfie from partnerdocuments ─────────────────────────
    ...(selfieTypeId
      ? [
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
                { $project: { _id: 0, url: "$cloudinary.url" } },
              ],
              as: "_selfie",
            },
          },
          {
            $addFields: {
              selfieUrl: { $arrayElemAt: ["$_selfie.url", 0] },
            },
          },
          { $project: { _selfie: 0 } },
        ]
      : []),

    // ── Stage 5: shape response ───────────────────────────────────────────────
    {
      $project: {
        fullName: 1,
        profilePhoto: 1,
        selfieUrl: 1,
        bio: 1,
        skills: 1,
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
      },
    },

    // ── Stage 6: nearest first ────────────────────────────────────────────────
    { $sort: { distanceKm: 1 } },
  ];

  return Partner.aggregate(pipeline);
}
