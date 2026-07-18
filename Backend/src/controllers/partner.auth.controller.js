import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Partner from "../models/partner/Partner.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate a random 6-digit OTP string */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/** Sign a JWT for a partner */
const signToken = (partnerId) =>
  jwt.sign({ id: partnerId }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ─── STEP 1 : Send OTP ───────────────────────────────────────────────────────
/**
 * POST /api/partner/auth/send-otp
 * Body: { phone }
 *
 * - Creates the partner document if first time (phone only).
 * - Generates OTP, hashes it, stores hash + expiry in DB.
 * - Returns OTP in response (dev/test mode — remove in production).
 */
export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    // Find existing partner or create a minimal doc with just the phone
    let partner = await Partner.findOne({ phone });
    if (!partner) {
      partner = new Partner({ phone, fullName: "Pending" });
      // fullName is required in schema; placeholder until profile step
    }

    // Generate OTP
    const otp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(otp, salt);

    // Store hash + 5-minute expiry
    partner.phoneOtp = {
      hash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // +5 min
    };

    await partner.save();

    // ⚠️  DEV ONLY — log OTP to console, return in response
    console.log(`[DEV] OTP for ${phone}: ${otp}`);

    return res.status(200).json({
      message: "OTP sent successfully.",
      // Remove the line below before going to production
      otp,
    });
  } catch (error) {
    console.error("sendOtp error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── STEP 2 : Verify OTP ────────────────────────────────────────────────────
/**
 * POST /api/partner/auth/verify-otp
 * Body: { phone, otp }
 *
 * - Validates OTP against stored hash and expiry.
 * - Marks phone as verified.
 * - Returns JWT + isNewPartner flag so frontend knows to show profile setup.
 */
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required." });
    }

    const partner = await Partner.findOne({ phone });

    if (!partner) {
      return res.status(404).json({ message: "Partner not found. Please request an OTP first." });
    }

    // Check if OTP was generated
    if (!partner.phoneOtp?.hash || !partner.phoneOtp?.expiresAt) {
      return res.status(400).json({ message: "No OTP found. Please request a new one." });
    }

    // Check expiry
    if (new Date() > partner.phoneOtp.expiresAt) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Validate hash
    const isMatch = await bcrypt.compare(otp, partner.phoneOtp.hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // Mark phone verified and clear OTP from DB
    partner.verification.phoneVerified = true;
    partner.phoneOtp = undefined;
    await partner.save();

    // Determine if this partner still needs to complete profile
    const isProfileComplete = !!(
      partner.fullName &&
      partner.fullName !== "Pending" &&
      partner.gender &&
      partner.dateOfBirth
    );

    const token = signToken(partner._id);

    // Set JWT in httpOnly cookie
    res.cookie("partner_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      message: "Phone verified successfully.",
      isNewPartner: !isProfileComplete,
      partner: {
        id: partner._id,
        phone: partner.phone,
        fullName: partner.fullName !== "Pending" ? partner.fullName : null,
        phoneVerified: partner.verification.phoneVerified,
        verificationStatus: partner.verificationStatus,
        isProfile: partner.isProfile,
        isService: partner.isService,
        isDocument: partner.isDocument,
      },
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── STEP 3 : Complete Profile (called after OTP verified) ──────────────────
/**
 * PUT /api/partner/auth/complete-profile
 * Headers: Cookie partner_token=<jwt>
 * Body: { fullName, gender, dateOfBirth, profilePhoto, address, location }
 *
 * address : { house, street, locality, city*, state*, pincode* }
 * location: { latitude*, longitude* }  — stored as GeoJSON Point (hidden from partner UI)
 *
 * Only allowed after phone is verified.
 */
export const completeProfile = async (req, res) => {
  try {
    const { fullName, gender, dateOfBirth, profilePhoto, address, location } = req.body;

    const partner = await Partner.findById(req.partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    if (!partner.verification.phoneVerified) {
      return res.status(403).json({ message: "Phone not verified. Complete OTP verification first." });
    }

    if (!fullName || !gender || !dateOfBirth) {
      return res.status(400).json({ message: "fullName, gender, and dateOfBirth are required." });
    }

    // ── Address validation ───────────────────────────────────────────────
    if (!address || !address.city || !address.state || !address.pincode) {
      return res.status(400).json({
        message: "address.city, address.state, and address.pincode are required.",
      });
    }

    if (!/^\d{6}$/.test(address.pincode)) {
      return res.status(400).json({ message: "Pincode must be exactly 6 digits." });
    }

    partner.fullName = fullName.trim();
    partner.gender = gender;
    partner.dateOfBirth = new Date(dateOfBirth);
    if (profilePhoto) partner.profilePhoto = profilePhoto;

    partner.address = {
      house:    address.house?.trim()    ?? partner.address?.house,
      street:   address.street?.trim()   ?? partner.address?.street,
      locality: address.locality?.trim() ?? partner.address?.locality,
      city:     address.city.trim(),
      state:    address.state.trim(),
      pincode:  address.pincode.trim(),
    };

    // ── Store GPS coords as GeoJSON Point (used for proximity matching) ──
    // GeoJSON requires [longitude, latitude] order
    if (location?.latitude && location?.longitude) {
      partner.serviceLocation = {
        type: "Point",
        coordinates: [location.longitude, location.latitude],
      };
    }

    // Mark profile step as complete
    partner.isProfile = true;

    await partner.save();

    return res.status(200).json({
      message: "Profile updated successfully.",
      partner: {
        id: partner._id,
        fullName: partner.fullName,
        gender: partner.gender,
        dateOfBirth: partner.dateOfBirth,
        profilePhoto: partner.profilePhoto,
        address: partner.address,
        isProfile: partner.isProfile,
        isService: partner.isService,
        isDocument: partner.isDocument,
      },
    });
  } catch (error) {
    console.error("completeProfile error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── Me (restore session) ────────────────────────────────────────────────────
/**
 * GET /api/partner/auth/me
 * Headers: Cookie partner_token=<jwt>
 *
 * Returns the authenticated partner's public fields.
 * Used by the frontend on app boot to restore session state.
 */
export const getMe = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partnerId).select(
      "_id phone fullName verification.phoneVerified verificationStatus rejectionReason isProfile isService isDocument"
    );

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    return res.status(200).json({
      partner: {
        id: partner._id,
        phone: partner.phone,
        fullName: partner.fullName !== "Pending" ? partner.fullName : null,
        phoneVerified: partner.verification.phoneVerified,
        verificationStatus: partner.verificationStatus,
        rejectionReason: partner.rejectionReason ?? null,
        isProfile: partner.isProfile,
        isService: partner.isService,
        isDocument: partner.isDocument,
      },
    });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── Logout ─────────────────────────────────────────────────────────────────
/**
 * POST /api/partner/auth/logout
 */
export const logout = (req, res) => {
  res.clearCookie("partner_token");
  return res.status(200).json({ message: "Logged out successfully." });
};
