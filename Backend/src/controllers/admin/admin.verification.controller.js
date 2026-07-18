import Partner from "../../models/partner/Partner.js";
import DocumentType from "../../models/verification/DocumentType.js";
import PartnerDocument from "../../models/verification/PartnerDocument.js";
import VerificationSession from "../../models/verification/VerificationSession.js";

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * pushHistory(session, status, admin, note)
 *
 * Appends a history entry to the VerificationSession.
 * Called by every admin action so the audit log is always complete.
 */
const pushHistory = (session, status, admin, note = "") => {
  session.history.push({
    status,
    changedBy:     admin._id,
    changedByRole: "admin",
    changedByName: admin.name,
    changedAt:     new Date(),
    note,
  });
};

/**
 * syncOverallFromDocuments(partnerId, session, admin)
 *
 * After any document-level approve/reject, re-evaluates the overall
 * verification status by checking all required document states.
 *
 * Rules:
 *   - All required docs Approved      → session "Approved"
 *   - Any required doc Rejected       → session stays "Rejected" (or set it)
 *   - All required docs uploaded      → session "Under Review" (no change needed)
 *
 * This is the auto-promotion logic: admin approves the last required document
 * and the partner is automatically fully verified. No extra click needed.
 *
 * @param {ObjectId}           partnerId
 * @param {VerificationSession} session    — mutable, caller must save()
 * @param {Admin}              admin
 * @returns {string}  the new overallStatus
 */
const syncOverallFromDocuments = async (partnerId, session, admin) => {
  // Load snapshot of required document types for this session
  // We use the snapshot to avoid retroactive config changes affecting in-progress sessions
  let requiredDocTypeIds = session.requiredDocumentsSnapshot || [];

  // Fallback: if snapshot is empty (session created before this system), load live
  if (requiredDocTypeIds.length === 0) {
    const liveDocs = await DocumentType.find({ isActive: true, isRequired: true })
      .select("_id")
      .lean();
    requiredDocTypeIds = liveDocs.map((d) => d._id);
  }

  if (requiredDocTypeIds.length === 0) {
    // No required documents at all — auto-approve
    return "Approved";
  }

  // Fetch all active (non-Superseded) uploads for required document types
  const activeUploads = await PartnerDocument.find({
    partnerId,
    documentTypeId: { $in: requiredDocTypeIds },
    status:         { $ne: "Superseded" },
  }).lean();

  // Build a lookup: documentTypeId → array of active uploads (for multi-page docs)
  const uploadsByType = new Map();
  for (const upload of activeUploads) {
    const key = upload.documentTypeId.toString();
    if (!uploadsByType.has(key)) uploadsByType.set(key, []);
    uploadsByType.get(key).push(upload);
  }

  // For each required doc type, check if all slots are Approved
  let allApproved = true;
  let anyRejected = false;

  for (const docTypeId of requiredDocTypeIds) {
    const uploads = uploadsByType.get(docTypeId.toString()) || [];

    if (uploads.length === 0) {
      // Not uploaded at all — can't be approved
      allApproved = false;
      continue;
    }

    for (const upload of uploads) {
      if (upload.status === "Rejected") {
        anyRejected = true;
        allApproved = false;
      } else if (upload.status !== "Approved") {
        // Under Review or Pending — not yet approved
        allApproved = false;
      }
    }
  }

  if (allApproved) {
    return "Approved";
  }

  if (anyRejected) {
    return "Rejected";
  }

  // Some are approved, some still Under Review — stay Under Review
  return "Under Review";
};

// ─── GET PENDING PARTNERS ─────────────────────────────────────────────────────
/**
 * GET /api/admin/verification/pending
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Returns partners whose VerificationSession is "Under Review" —
 * i.e., they've submitted all required docs and are waiting for admin action.
 *
 * Sorted oldest-first (FIFO) so admins review in submission order.
 * Partners who submitted first get reviewed first.
 *
 * Query params:
 *   page    (default 1)
 *   limit   (default 20, max 100)
 */
export const getPendingVerifications = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    // Query sessions directly — more accurate than querying Partner.verificationStatus
    // because a partner can have verificationStatus "Under Review" but their session
    // might be in a different state if there was a sync lag.
    const [sessions, total] = await Promise.all([
      VerificationSession.find({ overallStatus: "Under Review" })
        .sort({ submittedAt: 1 })   // oldest first — fair queue
        .skip(skip)
        .limit(limit)
        .populate({
          path:   "partnerId",
          select: "fullName phone profilePhoto address.city address.state verificationStatus",
        })
        .lean(),
      VerificationSession.countDocuments({ overallStatus: "Under Review" }),
    ]);

    // Shape the response — combine session metadata with partner info
    const partners = sessions.map((s) => ({
      sessionId:     s._id,
      sessionNumber: s.sessionNumber,
      submittedAt:   s.submittedAt,
      partner:       s.partnerId,   // populated above
    }));

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
    console.error("getPendingVerifications error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── GET PARTNER VERIFICATION DETAIL ─────────────────────────────────────────
/**
 * GET /api/admin/verification/:partnerId
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Returns the full verification detail view for the admin review screen:
 *   - Partner profile summary
 *   - Current VerificationSession (with history)
 *   - All active documents, each merged with their DocumentType config
 *
 * This is the admin's equivalent of GET /partner/verification.
 * It returns the same document shape as the partner view plus admin-only fields
 * (approvedBy/rejectedBy names, version history count, upload metadata).
 */
export const getPartnerVerificationDetail = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const partner = await Partner.findById(partnerId)
      .select(
        "fullName phone profilePhoto address categories " +
        "verificationStatus accountStatus isProfile isService isDocument " +
        "averageRating completedJobs createdAt"
      )
      .populate("categories", "name icon")
      .lean();

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    // Load the latest session (any status — admin needs full picture)
    const session = await VerificationSession.findOne({ partnerId })
      .sort({ createdAt: -1 })
      .populate("reviewedBy", "name email")
      .lean();

    // Load all active (non-Superseded) documents for this partner
    const activeUploads = await PartnerDocument.find({
      partnerId,
      status: { $ne: "Superseded" },
    })
      .populate("documentTypeId")        // get full config
      .populate("approvedBy", "name")
      .populate("rejectedBy", "name")
      .lean();

    // Count historical uploads per slot (how many times each was re-uploaded)
    const historyCounts = await PartnerDocument.aggregate([
      {
        $match: {
          partnerId:    partner._id,
          status:       "Superseded",
        },
      },
      {
        $group: {
          _id:   { documentTypeId: "$documentTypeId", side: "$side" },
          count: { $sum: 1 },
        },
      },
    ]);

    const historyCountMap = new Map();
    for (const entry of historyCounts) {
      const key = `${entry._id.documentTypeId.toString()}_${entry._id.side}`;
      historyCountMap.set(key, entry.count);
    }

    // Build the document list for admin view
    const documents = activeUploads.map((upload) => {
      const docType     = upload.documentTypeId; // populated
      const historyKey  = `${docType._id.toString()}_${upload.side}`;
      const reuploadCount = historyCountMap.get(historyKey) || 0;

      return {
        // ── IDs for action endpoints ──────────────────────────────────────
        documentId:     upload._id,
        documentTypeId: docType._id,
        key:            upload.side === "single"
          ? docType.key
          : `${docType.key}_${upload.side}`,
        side:           upload.side,

        // ── Display ───────────────────────────────────────────────────────
        title:    docType.label + (
          upload.side === "front" ? " (Front)" :
          upload.side === "back"  ? " (Back)"  : ""
        ),
        icon:          docType.icon   || null,
        isRequired:    docType.isRequired,
        requiredLabel: docType.isRequired ? "Required" : "Optional",

        // ── Upload data ───────────────────────────────────────────────────
        status:        upload.status,         // raw: "Under Review" | "Approved" | "Rejected"
        previewUrl:    upload.cloudinary?.url || null,
        numberValue:   upload.numberValue     || null,
        uploadedAt:    upload.uploadedAt,
        version:       upload.version,
        reuploadCount, // how many times this slot was previously uploaded

        // ── File metadata ─────────────────────────────────────────────────
        fileFormat: upload.cloudinary?.format || null,
        fileBytes:  upload.cloudinary?.bytes  || null,

        // ── Admin action audit ────────────────────────────────────────────
        approvedBy:  upload.approvedBy?.name || null,
        approvedAt:  upload.approvedAt       || null,
        rejectedBy:  upload.rejectedBy?.name || null,
        rejectedAt:  upload.rejectedAt       || null,
        rejectionReason: upload.rejectionReason || null,
      };
    });

    // Sort documents by documentType displayOrder for consistent UI ordering
    documents.sort((a, b) => {
      const orderA = a.documentTypeId?.displayOrder ?? 999;
      const orderB = b.documentTypeId?.displayOrder ?? 999;
      return orderA - orderB;
    });

    // Compute summary for this partner's documents
    const summary = {
      total:       documents.length,
      approved:    documents.filter((d) => d.status === "Approved").length,
      rejected:    documents.filter((d) => d.status === "Rejected").length,
      underReview: documents.filter((d) => d.status === "Under Review").length,
      pending:     documents.filter((d) => d.status === "Pending").length,
    };

    return res.status(200).json({
      partner,
      session: session
        ? {
            sessionId:     session._id,
            sessionNumber: session.sessionNumber,
            overallStatus: session.overallStatus,
            submittedAt:   session.submittedAt,
            completedAt:   session.completedAt,
            reviewedBy:    session.reviewedBy,
            reviewedAt:    session.reviewedAt,
            reviewNotes:   session.reviewNotes,
            history:       session.history,  // full audit log
          }
        : null,
      summary,
      documents,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("getPartnerVerificationDetail error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── APPROVE DOCUMENT ─────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/verification/:partnerId/documents/:documentId/approve
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Approves a single PartnerDocument.
 * After approval, checks if all required documents are now Approved.
 * If yes → auto-promotes the overall verification to Approved.
 *
 * Body: { note } — optional admin note
 */
export const approveDocument = async (req, res) => {
  try {
    const { partnerId, documentId } = req.params;
    const { note = "" } = req.body;

    const document = await PartnerDocument.findOne({
      _id:       documentId,
      partnerId,
      status:    { $ne: "Superseded" },
    }).populate("documentTypeId", "label key");

    if (!document) {
      return res.status(404).json({
        message: "Document not found or does not belong to this partner.",
      });
    }

    if (document.status === "Approved") {
      return res.status(400).json({ message: "Document is already approved." });
    }

    // ── Approve the document ───────────────────────────────────────────────
    document.status     = "Approved";
    document.approvedBy = req.admin._id;
    document.approvedAt = new Date();
    // Clear any previous rejection data
    document.rejectionReason = null;
    document.rejectedBy      = null;
    document.rejectedAt      = null;
    await document.save();

    // ── Get / ensure session exists ────────────────────────────────────────
    const session = await VerificationSession.findOne({ partnerId })
      .sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "Verification session not found." });
    }

    // ── Check if all required docs are now approved (auto-promote) ─────────
    const newOverallStatus = await syncOverallFromDocuments(partnerId, session, req.admin);

    const statusChanged = newOverallStatus !== session.overallStatus;

    if (statusChanged) {
      pushHistory(
        session,
        newOverallStatus,
        req.admin,
        newOverallStatus === "Approved"
          ? `All required documents approved. Partner verified. ${note}`.trim()
          : note
      );
      session.overallStatus = newOverallStatus;

      if (newOverallStatus === "Approved") {
        session.completedAt = new Date();
        session.reviewedBy  = req.admin._id;
        session.reviewedAt  = new Date();
        session.reviewNotes = note || "All required documents approved.";
      }
    } else {
      // Status didn't change but record the document approval in history
      pushHistory(
        session,
        session.overallStatus,
        req.admin,
        `Approved: ${document.documentTypeId.label}. ${note}`.trim()
      );
    }

    await session.save();

    // ── Sync Partner.verificationStatus ───────────────────────────────────
    const partnerStatusMap = {
      Approved:      "Approved",
      Rejected:      "Rejected",
      "Under Review": "Under Review",
    };
    await Partner.findByIdAndUpdate(partnerId, {
      $set: {
        verificationStatus: partnerStatusMap[newOverallStatus] || "Under Review",
        ...(newOverallStatus === "Approved"
          ? { verifiedBy: req.admin._id, verifiedAt: new Date() }
          : {}),
      },
    });

    return res.status(200).json({
      message:       `Document approved.${newOverallStatus === "Approved" ? " Partner is now fully verified." : ""}`,
      documentId,
      documentStatus: "Approved",
      overallStatus:  newOverallStatus,
      autoPromoted:   newOverallStatus === "Approved" && statusChanged,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID." });
    }
    console.error("approveDocument error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── REJECT DOCUMENT ──────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/verification/:partnerId/documents/:documentId/reject
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Rejects a single PartnerDocument with a mandatory reason.
 * After rejection, the overall session status becomes "Rejected"
 * and Partner.verificationStatus is synced.
 *
 * Body: { reason }  — required, min 10 characters
 */
export const rejectDocument = async (req, res) => {
  try {
    const { partnerId, documentId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        message: "A rejection reason of at least 10 characters is required.",
      });
    }

    const document = await PartnerDocument.findOne({
      _id:       documentId,
      partnerId,
      status:    { $ne: "Superseded" },
    }).populate("documentTypeId", "label key");

    if (!document) {
      return res.status(404).json({
        message: "Document not found or does not belong to this partner.",
      });
    }

    if (document.status === "Rejected") {
      return res.status(400).json({ message: "Document is already rejected." });
    }

    // ── Reject the document ────────────────────────────────────────────────
    document.status          = "Rejected";
    document.rejectionReason = reason.trim();
    document.rejectedBy      = req.admin._id;
    document.rejectedAt      = new Date();
    // Clear any previous approval data
    document.approvedBy = null;
    document.approvedAt = null;
    await document.save();

    // ── Get session and update status ──────────────────────────────────────
    const session = await VerificationSession.findOne({ partnerId })
      .sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "Verification session not found." });
    }

    // Rejection always sets overall to Rejected
    const previousStatus  = session.overallStatus;
    session.overallStatus = "Rejected";
    session.completedAt   = new Date();
    session.reviewedBy    = req.admin._id;
    session.reviewedAt    = new Date();
    session.reviewNotes   = `${document.documentTypeId.label} rejected: ${reason.trim()}`;

    pushHistory(
      session,
      "Rejected",
      req.admin,
      `Rejected: ${document.documentTypeId.label}. Reason: ${reason.trim()}`
    );

    await session.save();

    // ── Sync Partner.verificationStatus ───────────────────────────────────
    await Partner.findByIdAndUpdate(partnerId, {
      $set: {
        verificationStatus: "Rejected",
        rejectionReason:    reason.trim(),
        verifiedBy:         req.admin._id,
        verifiedAt:         new Date(),
      },
    });

    return res.status(200).json({
      message:        "Document rejected.",
      documentId,
      documentStatus: "Rejected",
      rejectionReason: reason.trim(),
      overallStatus:  "Rejected",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID." });
    }
    console.error("rejectDocument error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── FORCE-APPROVE ENTIRE VERIFICATION ───────────────────────────────────────
/**
 * PATCH /api/admin/verification/:partnerId/approve
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Overrides the auto-promotion logic and approves the entire verification.
 * Used when an admin wants to approve a partner even if some optional
 * documents are still Under Review (e.g., PAN is optional and pending).
 *
 * Business rule: at least one required document must exist and not be Rejected.
 * You cannot force-approve a partner with zero uploads.
 *
 * Body: { note } — optional
 */
export const forceApproveVerification = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { note = "" } = req.body;

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (partner.verificationStatus === "Approved") {
      return res.status(400).json({ message: "Partner is already approved." });
    }

    // Must have at least one non-Superseded upload
    const uploadCount = await PartnerDocument.countDocuments({
      partnerId,
      status: { $ne: "Superseded" },
    });

    if (uploadCount === 0) {
      return res.status(400).json({
        message: "Cannot approve a partner with no uploaded documents.",
      });
    }

    // Load session
    const session = await VerificationSession.findOne({ partnerId })
      .sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "Verification session not found." });
    }

    session.overallStatus = "Approved";
    session.completedAt   = new Date();
    session.reviewedBy    = req.admin._id;
    session.reviewedAt    = new Date();
    session.reviewNotes   = note || "Manually approved by admin.";

    pushHistory(
      session,
      "Approved",
      req.admin,
      note || "Verification manually approved by admin."
    );

    await session.save();

    // Sync partner
    partner.verificationStatus = "Approved";
    partner.rejectionReason    = undefined;
    partner.verifiedBy         = req.admin._id;
    partner.verifiedAt         = new Date();
    await partner.save();

    return res.status(200).json({
      message: "Partner verification approved.",
      partnerId,
      overallStatus: "Approved",
      verifiedBy:    req.admin.name,
      verifiedAt:    new Date(),
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("forceApproveVerification error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── FORCE-REJECT ENTIRE VERIFICATION ────────────────────────────────────────
/**
 * PATCH /api/admin/verification/:partnerId/reject
 * 🔒 ADMIN | SUPER_ADMIN
 *
 * Overrides and rejects the entire verification with a mandatory reason.
 * Used for cases like fraud detection, policy violations, or when the admin
 * wants to reject the whole submission regardless of individual document states.
 *
 * Body: { reason }  — required, min 10 characters
 */
export const forceRejectVerification = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        message: "A rejection reason of at least 10 characters is required.",
      });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (partner.verificationStatus === "Rejected") {
      return res.status(400).json({ message: "Partner verification is already rejected." });
    }

    // Load session
    const session = await VerificationSession.findOne({ partnerId })
      .sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "Verification session not found." });
    }

    session.overallStatus = "Rejected";
    session.completedAt   = new Date();
    session.reviewedBy    = req.admin._id;
    session.reviewedAt    = new Date();
    session.reviewNotes   = reason.trim();

    pushHistory(
      session,
      "Rejected",
      req.admin,
      reason.trim()
    );

    await session.save();

    // Sync partner
    partner.verificationStatus = "Rejected";
    partner.rejectionReason    = reason.trim();
    partner.verifiedBy         = req.admin._id;
    partner.verifiedAt         = new Date();
    await partner.save();

    return res.status(200).json({
      message:         "Partner verification rejected.",
      partnerId,
      overallStatus:   "Rejected",
      rejectionReason: reason.trim(),
      rejectedBy:      req.admin.name,
      rejectedAt:      new Date(),
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid partner ID." });
    }
    console.error("forceRejectVerification error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
