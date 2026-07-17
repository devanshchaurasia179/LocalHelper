import Partner from "../../models/partner/Partner.js";

// ─── Shared field selectors ───────────────────────────────────────────────────
// Used in list queries — we don't need every field for a table row.
// Keeping the projection tight reduces data transfer and serialization cost.
const LIST_FIELDS =
  "_id fullName phone profilePhoto address.city address.state " +
  "verificationStatus accountStatus isProfile isService isDocument " +
  "averageRating completedJobs createdAt";

// ─── GET ALL PARTNERS ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/partners
 * Query params:
 *   page            (default 1)
 *   limit           (default 10, max 100)
 *   search          fullName or phone substring search
 *   verificationStatus  Pending | Under Review | Approved | Rejected
 *   accountStatus       Active | Blocked | Suspended
 *   city            filter by address.city
 *   sortBy          field to sort on (default: createdAt)
 *   sortOrder       asc | desc (default: desc)
 *
 * Response includes:
 *   partners[]  — paginated list
 *   pagination  — page, limit, total, totalPages
 */
export const getAllPartners = async (req, res) => {
  try {
    // ── 1. Parse & sanitize query params ─────────────────────────────────────
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip  = (page - 1) * limit;

    const { search, verificationStatus, accountStatus, city } = req.query;
    const sortBy    = req.query.sortBy    || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // ── 2. Build the filter object dynamically ────────────────────────────────
    // We only add a key to `filter` if the query param was actually provided.
    // This avoids `{ verificationStatus: undefined }` which would match nothing.
    const filter = {};

    if (verificationStatus) {
      filter.verificationStatus = verificationStatus;
    }

    if (accountStatus) {
      filter.accountStatus = accountStatus;
    }

    if (city) {
      // case-insensitive city filter
      filter["address.city"] = { $regex: city, $options: "i" };
    }

    if (search) {
      // $or lets us search across multiple fields at once.
      // $regex = "contains" search, $options: "i" = case-insensitive.
      // For production with millions of records, replace with Atlas Search.
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { phone:    { $regex: search, $options: "i" } },
      ];
    }

    // ── 3. Run query + count in parallel ─────────────────────────────────────
    // Promise.all fires both queries simultaneously instead of sequentially.
    // This saves one full round-trip to MongoDB.
    const [partners, total] = await Promise.all([
      Partner.find(filter)
        .select(LIST_FIELDS)
        .populate("categories", "name icon")   // replace ObjectId with {name, icon}
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),                               // .lean() returns plain JS objects
                                               // ~3× faster than Mongoose documents
                                               // when you don't need .save() etc.
      Partner.countDocuments(filter),
    ]);

    return res.status(200).json({
      partners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getAllPartners error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET PENDING PARTNERS ─────────────────────────────────────────────────────

/**
 * GET /api/admin/partners/pending
 *
 * Shortcut endpoint — returns only partners with verificationStatus
 * "Under Review" (i.e., they've submitted documents and are awaiting admin action).
 *
 * Why a separate endpoint instead of using ?verificationStatus=Under Review?
 *   The admin dashboard will have a dedicated "Pending Verifications" panel
 *   with its own UI. A dedicated route is cleaner, self-documenting, and
 *   lets us add pending-specific logic later (e.g., oldest first priority sort).
 *
 * Supports the same pagination as getAllPartners.
 */
export const getPendingPartners = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip  = (page - 1) * limit;

    const filter = { verificationStatus: "Under Review" };

    const [partners, total] = await Promise.all([
      Partner.find(filter)
        .select(LIST_FIELDS)
        .populate("categories", "name icon")
        // Oldest first — admins should review in the order submissions arrived
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Partner.countDocuments(filter),
    ]);

    return res.status(200).json({
      partners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getPendingPartners error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET PARTNER BY ID ────────────────────────────────────────────────────────

/**
 * GET /api/admin/partners/:id
 *
 * Returns the full partner profile for the admin review screen.
 * This is the "detail view" — we pull everything:
 *   - Personal info + address
 *   - KYC documents (Aadhaar, PAN, selfie) with Cloudinary URLs
 *   - Service info (categories, skills, working days, pricing)
 *   - Verification history (verifiedBy populated with admin name)
 *   - Rating + earnings stats
 *
 * We deliberately exclude:
 *   - phoneOtp (internal OTP hash — no reason for admin to see it)
 */
export const getPartnerById = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id)
      .select("-phoneOtp")                        // strip the OTP hash
      .populate("categories", "name icon")        // service categories
      .populate("verifiedBy", "name email role")  // admin who last acted
      .lean();

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    return res.status(200).json({ partner });
  } catch (error) {
    // Mongoose throws CastError if :id is not a valid ObjectId format
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("getPartnerById error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── APPROVE PARTNER ──────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/partners/:id/approve
 *
 * Sets verificationStatus to "Approved".
 * Records which admin approved and when (audit trail).
 *
 * Business rule: can only approve partners who are "Under Review".
 * Approving an already-Approved partner would be a no-op mistake.
 */
export const approvePartner = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (partner.verificationStatus === "Approved") {
      return res.status(400).json({ message: "Partner is already approved." });
    }

    // Business rule: must have submitted documents before approval
    if (partner.verificationStatus === "Pending") {
      return res.status(400).json({
        message: "Partner has not submitted documents yet. Status is still Pending.",
      });
    }

    partner.verificationStatus  = "Approved";
    partner.rejectionReason     = undefined;   // clear any previous rejection reason
    partner.verifiedBy          = req.admin._id;  // req.admin set by protectAdmin
    partner.verifiedAt          = new Date();

    await partner.save();

    // TODO (future): send SMS/push notification to partner

    return res.status(200).json({
      message: "Partner approved successfully.",
      partner: {
        id:                 partner._id,
        fullName:           partner.fullName,
        verificationStatus: partner.verificationStatus,
        verifiedBy:         req.admin.name,
        verifiedAt:         partner.verifiedAt,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("approvePartner error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── REJECT PARTNER ───────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/partners/:id/reject
 * Body: { reason }
 *
 * Sets verificationStatus to "Rejected" and stores the rejection reason.
 * The partner app will show this reason so the partner knows what to fix
 * before re-submitting.
 *
 * rejectionReason is REQUIRED — admins must explain why.
 */
export const rejectPartner = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        message: "A rejection reason of at least 10 characters is required.",
      });
    }

    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (partner.verificationStatus === "Rejected") {
      return res.status(400).json({ message: "Partner is already rejected." });
    }

    partner.verificationStatus = "Rejected";
    partner.rejectionReason    = reason.trim();
    partner.verifiedBy         = req.admin._id;
    partner.verifiedAt         = new Date();

    await partner.save();

    // TODO (future): send SMS/push notification with rejection reason

    return res.status(200).json({
      message: "Partner rejected.",
      partner: {
        id:                 partner._id,
        fullName:           partner.fullName,
        verificationStatus: partner.verificationStatus,
        rejectionReason:    partner.rejectionReason,
        verifiedBy:         req.admin.name,
        verifiedAt:         partner.verifiedAt,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("rejectPartner error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// MILESTONE 3 — PARTNER MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

// ─── Shared helper ────────────────────────────────────────────────────────────
/**
 * setAccountStatus(id, status, reason, adminId)
 *
 * DRY helper used by block, unblock, suspend, reactivate.
 * All four actions do the same thing — find partner, update accountStatus,
 * optionally record a reason, save. Centralizing this removes 4x duplicate code.
 *
 * @param {string} id        - partner ObjectId from req.params.id
 * @param {string} status    - "Active" | "Blocked" | "Suspended"
 * @param {string|null} reason - admin's reason for the action
 * @param {ObjectId} adminId - req.admin._id for the audit trail
 * @returns {{ partner, error, statusCode }}
 */
const setAccountStatus = async (id, status, reason, adminId) => {
  const partner = await Partner.findById(id);

  if (!partner) {
    return { partner: null, error: "Partner not found.", statusCode: 404 };
  }

  if (partner.isDeleted) {
    return { partner: null, error: "Partner account has been deleted.", statusCode: 410 };
  }

  if (partner.accountStatus === status) {
    return {
      partner: null,
      error: `Partner is already ${status.toLowerCase()}.`,
      statusCode: 400,
    };
  }

  partner.accountStatus = status;
  partner.statusReason  = reason || null;
  // Re-use verifiedBy to track which admin last changed the account status.
  // In a larger system you'd have a separate actionLog array, but this is
  // clean and sufficient for this stage.
  partner.verifiedBy    = adminId;
  partner.verifiedAt    = new Date();

  await partner.save();
  return { partner, error: null, statusCode: null };
};

// ─── BLOCK PARTNER ────────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/partners/:id/block
 * Body: { reason }  (optional but strongly recommended)
 *
 * Blocked partner:
 *   - Cannot log in to the partner app
 *   - Hidden from customer search results
 *   - Any in-progress bookings should be handled manually (out of scope here)
 *
 * Why we don't cancel bookings automatically:
 *   Automating that requires notifying customers, issuing refunds, reassigning
 *   partners. That's the Booking module's job. Admin simply flags the account.
 */
export const blockPartner = async (req, res) => {
  try {
    const { reason } = req.body;
    const { partner, error, statusCode } = await setAccountStatus(
      req.params.id,
      "Blocked",
      reason,
      req.admin._id
    );

    if (error) return res.status(statusCode).json({ message: error });

    return res.status(200).json({
      message: "Partner has been blocked.",
      partner: {
        id:            partner._id,
        fullName:      partner.fullName,
        accountStatus: partner.accountStatus,
        statusReason:  partner.statusReason,
        updatedBy:     req.admin.name,
        updatedAt:     partner.verifiedAt,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("blockPartner error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── UNBLOCK PARTNER ──────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/partners/:id/unblock
 *
 * Restores the partner to Active status.
 * Only makes sense when current status is Blocked.
 */
export const unblockPartner = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (partner.isDeleted) {
      return res.status(410).json({ message: "Partner account has been deleted." });
    }

    // Guard: can only unblock a Blocked partner
    if (partner.accountStatus !== "Blocked") {
      return res.status(400).json({
        message: `Cannot unblock. Partner status is currently "${partner.accountStatus}".`,
      });
    }

    partner.accountStatus = "Active";
    partner.statusReason  = null;   // clear the reason when restoring
    partner.verifiedBy    = req.admin._id;
    partner.verifiedAt    = new Date();

    await partner.save();

    return res.status(200).json({
      message: "Partner has been unblocked and is now Active.",
      partner: {
        id:            partner._id,
        fullName:      partner.fullName,
        accountStatus: partner.accountStatus,
        updatedBy:     req.admin.name,
        updatedAt:     partner.verifiedAt,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("unblockPartner error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── SUSPEND PARTNER ──────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/partners/:id/suspend
 * Body: { reason }  (required — suspension must have a documented reason)
 *
 * Suspended = temporary hold, typically "under investigation".
 * Different from Blocked:
 *   - Blocked  → definitive action, partner violated policy
 *   - Suspended → temporary, pending investigation outcome
 *
 * In the partner app, a suspended partner should see a message:
 * "Your account is under review. Contact support."
 */
export const suspendPartner = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        message: "A suspension reason of at least 10 characters is required.",
      });
    }

    const { partner, error, statusCode } = await setAccountStatus(
      req.params.id,
      "Suspended",
      reason.trim(),
      req.admin._id
    );

    if (error) return res.status(statusCode).json({ message: error });

    return res.status(200).json({
      message: "Partner has been suspended.",
      partner: {
        id:            partner._id,
        fullName:      partner.fullName,
        accountStatus: partner.accountStatus,
        statusReason:  partner.statusReason,
        updatedBy:     req.admin.name,
        updatedAt:     partner.verifiedAt,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("suspendPartner error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── REACTIVATE PARTNER ───────────────────────────────────────────────────────
/**
 * PATCH /api/admin/partners/:id/reactivate
 *
 * Lifts a suspension and restores Active status.
 * Only valid when current status is Suspended.
 * (To restore a Blocked partner, use /unblock — intentional separation)
 */
export const reactivatePartner = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (partner.isDeleted) {
      return res.status(410).json({ message: "Partner account has been deleted." });
    }

    if (partner.accountStatus !== "Suspended") {
      return res.status(400).json({
        message: `Cannot reactivate. Partner status is currently "${partner.accountStatus}".`,
      });
    }

    partner.accountStatus = "Active";
    partner.statusReason  = null;
    partner.verifiedBy    = req.admin._id;
    partner.verifiedAt    = new Date();

    await partner.save();

    return res.status(200).json({
      message: "Partner suspension lifted. Account is now Active.",
      partner: {
        id:            partner._id,
        fullName:      partner.fullName,
        accountStatus: partner.accountStatus,
        updatedBy:     req.admin.name,
        updatedAt:     partner.verifiedAt,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("reactivatePartner error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── SOFT DELETE PARTNER ──────────────────────────────────────────────────────
/**
 * DELETE /api/admin/partners/:id
 * (Restricted to SUPER_ADMIN only — enforced in routes)
 *
 * Sets isDeleted = true and deletedAt = now.
 * The document is NEVER removed from MongoDB.
 *
 * Why SUPER_ADMIN only?
 *   Deletion is the most destructive action. Even though it's soft,
 *   the partner's app access is gone permanently. Only the top-level
 *   admin should have this power. A regular ADMIN account being compromised
 *   should not be able to mass-delete partners.
 *
 * What happens after soft delete:
 *   - Partner cannot log in (we check isDeleted in partner auth middleware — TODO)
 *   - Partner does not appear in any admin list queries
 *   - All their historical bookings remain intact and queryable
 *   - A background job can hard-delete documents older than 90 days
 */
export const softDeletePartner = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (partner.isDeleted) {
      return res.status(400).json({ message: "Partner is already deleted." });
    }

    partner.isDeleted  = true;
    partner.deletedAt  = new Date();
    // Also block the account so if isDeleted check is ever missed,
    // the accountStatus guard still prevents access
    partner.accountStatus = "Blocked";
    partner.statusReason  = "Account deleted by admin.";
    partner.verifiedBy    = req.admin._id;
    partner.verifiedAt    = new Date();

    await partner.save();

    return res.status(200).json({
      message: "Partner account has been soft deleted.",
      partner: {
        id:        partner._id,
        fullName:  partner.fullName,
        isDeleted: partner.isDeleted,
        deletedAt: partner.deletedAt,
        deletedBy: req.admin.name,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("softDeletePartner error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
