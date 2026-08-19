import Call from "../../models/call/call.js";

// ─── GET /api/admin/calls ────────────────────────────────────────────────────

export const getAllCalls = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      search,
      status,
      recordingStatus,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (recordingStatus) {
      filter["recording.status"] = recordingStatus;
    }

    // Build sort
    const allowedSortFields = ["createdAt", "duration", "startedAt"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sort = { [sortField]: sortOrder === "asc" ? 1 : -1 };

    // Build query — if search is provided, we need to filter by populated fields
    let calls;
    let total;

    if (search) {
      // First find matching customers/partners, then filter calls
      const mongoose = (await import("mongoose")).default;
      const Customer = (await import("../../models/customer/Customer.js")).default;
      const Partner = (await import("../../models/partner/Partner.js")).default;

      const searchRegex = new RegExp(search, "i");

      const [matchingCustomers, matchingPartners] = await Promise.all([
        Customer.find({
          $or: [{ name: searchRegex }, { phone: searchRegex }],
        }).select("_id").lean(),
        Partner.find({
          $or: [{ fullName: searchRegex }, { phone: searchRegex }],
        }).select("_id").lean(),
      ]);

      const customerIds = matchingCustomers.map((c) => c._id);
      const partnerIds = matchingPartners.map((p) => p._id);

      if (customerIds.length > 0 || partnerIds.length > 0) {
        filter.$or = [];
        if (customerIds.length > 0) {
          filter.$or.push({ customer: { $in: customerIds } });
        }
        if (partnerIds.length > 0) {
          filter.$or.push({ partner: { $in: partnerIds } });
        }
      } else {
        // No matching users found — return empty
        return res.status(200).json({
          success: true,
          calls: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        });
      }
    }

    [calls, total] = await Promise.all([
      Call.find(filter)
        .populate("customer", "name phone")
        .populate("partner", "fullName phone")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Call.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      calls,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get all calls error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch calls",
    });
  }
};
