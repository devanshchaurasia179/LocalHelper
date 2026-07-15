import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Customer from "../models/customer/Customer.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate a random 6-digit OTP string */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/** Sign a JWT for a customer */
const signToken = (customerId) =>
  jwt.sign({ id: customerId }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ─── STEP 1 : Send OTP ───────────────────────────────────────────────────────
/**
 * POST /api/customer/auth/send-otp
 * Body: { phone }
 *
 * - Creates the customer document if first time (phone only).
 * - Generates OTP, hashes it, stores hash + expiry in DB.
 * - Returns OTP in response (dev/test mode — remove in production).
 */
export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    // Find existing customer or create a minimal doc with just the phone
    let customer = await Customer.findOne({ phone });
    if (!customer) {
      customer = new Customer({ phone });
    }

    // Generate OTP
    const otp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(otp, salt);

    // Store hash + 5-minute expiry
    customer.phoneOtp = {
      hash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // +5 min
    };

    await customer.save();

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
 * POST /api/customer/auth/verify-otp
 * Body: { phone, otp }
 *
 * - Validates OTP against stored hash and expiry.
 * - Marks phone as verified.
 * - Returns JWT + isOnboarded flag so frontend knows to show profile setup.
 */
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required." });
    }

    const customer = await Customer.findOne({ phone });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found. Please request an OTP first." });
    }

    // Check if OTP was generated
    if (!customer.phoneOtp?.hash || !customer.phoneOtp?.expiresAt) {
      return res.status(400).json({ message: "No OTP found. Please request a new one." });
    }

    // Check expiry
    if (new Date() > customer.phoneOtp.expiresAt) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Validate hash
    const isMatch = await bcrypt.compare(otp, customer.phoneOtp.hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // Mark phone verified and clear OTP from DB
    customer.verification.phoneVerified = true;
    customer.phoneOtp = undefined;
    await customer.save();

    const token = signToken(customer._id);

    // Set JWT in httpOnly cookie
    res.cookie("customer_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      message: "Phone verified successfully.",
      customer: {
        id: customer._id,
        phone: customer.phone,
        name: customer.name ?? null,
        gender: customer.gender ?? null,
        addresses: customer.addresses ?? [],
        phoneVerified: customer.verification.phoneVerified,
        isOnboarded: customer.isOnboarded,
      },
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── STEP 3 : Complete Profile ───────────────────────────────────────────────
/**
 * PUT /api/customer/auth/complete-profile
 * Headers: Cookie customer_token=<jwt>
 * Body: { name, gender, address, location }
 *
 * address : { label*, house, street, locality, city*, state*, pincode* }
 * location: { latitude*, longitude* }  — stored as GeoJSON Point
 *
 * Only allowed after phone is verified.
 * Sets isOnboarded = true on success.
 */
export const completeProfile = async (req, res) => {
  try {
    const { name, gender, address, location } = req.body;

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    if (!customer.verification.phoneVerified) {
      return res
        .status(403)
        .json({ message: "Phone not verified. Complete OTP verification first." });
    }

    if (!name || !gender) {
      return res.status(400).json({ message: "name and gender are required." });
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

    customer.name = name.trim();
    customer.gender = gender;

    // Push the address into the addresses array (or replace the first entry if already exists)
    const newAddress = {
      label:    address.label?.trim()    || "Home",
      house:    address.house?.trim()    || "",
      street:   address.street?.trim()   || "",
      locality: address.locality?.trim() || "",
      city:     address.city.trim(),
      state:    address.state.trim(),
      pincode:  address.pincode.trim(),
    };

    if (customer.addresses.length === 0) {
      customer.addresses.push(newAddress);
    } else {
      // Update the first address saved during onboarding
      customer.addresses[0] = newAddress;
    }

    // ── Store GPS coords as GeoJSON Point (used for proximity matching) ──
    // GeoJSON requires [longitude, latitude] order
    if (location?.latitude && location?.longitude) {
      customer.currentLocation = {
        type: "Point",
        coordinates: [location.longitude, location.latitude],
      };
    }

    // Mark onboarding as complete
    customer.isOnboarded = true;

    await customer.save();

    return res.status(200).json({
      message: "Profile completed successfully.",
      customer: {
        id: customer._id,
        phone: customer.phone,
        name: customer.name,
        gender: customer.gender,
        addresses: customer.addresses,
        isOnboarded: customer.isOnboarded,
      },
    });
  } catch (error) {
    console.error("completeProfile error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── Me (restore session) ────────────────────────────────────────────────────
/**
 * GET /api/customer/auth/me
 * Headers: Cookie customer_token=<jwt>
 *
 * Returns the authenticated customer's public fields.
 * Used by the frontend on app boot to restore session state.
 */
export const getMe = async (req, res) => {
  try {
    const customer = await Customer.findById(req.customerId).select(
      "_id phone name gender addresses verification.phoneVerified isOnboarded"
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    return res.status(200).json({
      customer: {
        id: customer._id,
        phone: customer.phone,
        name: customer.name,
        gender: customer.gender,
        addresses: customer.addresses,
        phoneVerified: customer.verification.phoneVerified,
        isOnboarded: customer.isOnboarded,
      },
    });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── Update Profile ─────────────────────────────────────────────────────────
/**
 * PATCH /api/customer/auth/update-profile
 * Headers: Cookie customer_token=<jwt>
 * Body: { name?, gender? }
 *
 * Updates the customer's name and/or gender.
 * Returns the updated customer fields.
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, gender } = req.body;

    if (!name && !gender) {
      return res.status(400).json({ message: "Provide at least name or gender to update." });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        return res.status(400).json({ message: "Name must be at least 2 characters." });
      }
      customer.name = trimmed;
    }

    if (gender !== undefined) {
      customer.gender = gender;
    }

    await customer.save();

    return res.status(200).json({
      message: "Profile updated successfully.",
      customer: {
        id:     customer._id,
        name:   customer.name,
        gender: customer.gender,
      },
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── Add Address ────────────────────────────────────────────────────────────
/**
 * POST /api/customer/auth/add-address
 * Headers: Cookie customer_token=<jwt>
 * Body: { label, house, street, locality, city*, state*, pincode* }
 *
 * Appends a new address to the customer's addresses array.
 * Returns the full updated addresses list.
 */
export const addAddress = async (req, res) => {
  try {
    const { label, house, street, locality, city, state, pincode } = req.body;

    if (!city || !state || !pincode) {
      return res.status(400).json({
        message: "city, state, and pincode are required.",
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ message: "Pincode must be exactly 6 digits." });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const newAddress = {
      label:    label?.trim()    || "Home",
      house:    house?.trim()    || "",
      street:   street?.trim()   || "",
      locality: locality?.trim() || "",
      city:     city.trim(),
      state:    state.trim(),
      pincode:  pincode.trim(),
    };

    customer.addresses.push(newAddress);
    await customer.save();

    return res.status(201).json({
      message: "Address added successfully.",
      addresses: customer.addresses,
    });
  } catch (error) {
    console.error("addAddress error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── Update Address ─────────────────────────────────────────────────────────
/**
 * PATCH /api/customer/auth/update-address/:addressId
 * Headers: Cookie customer_token=<jwt>
 * Body: { label?, house?, street?, locality?, city*, state*, pincode*, location? }
 *
 * location: { latitude, longitude } — silently updates currentLocation if provided
 * Updates an existing address in the customer's addresses array by its _id.
 */
export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { label, house, street, locality, city, state, pincode, location } = req.body;

    if (!city || !state || !pincode) {
      return res.status(400).json({
        message: "city, state, and pincode are required.",
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ message: "Pincode must be exactly 6 digits." });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const addr = customer.addresses.id(addressId);
    if (!addr) {
      return res.status(404).json({ message: "Address not found." });
    }

    addr.label    = label?.trim()    || addr.label    || "Home";
    addr.house    = house?.trim()    ?? addr.house    ?? "";
    addr.street   = street?.trim()   ?? addr.street   ?? "";
    addr.locality = locality?.trim() ?? addr.locality ?? "";
    addr.city     = city.trim();
    addr.state    = state.trim();
    addr.pincode  = pincode.trim();

    // Silently store GPS coordinates if provided — no error if missing
    if (location?.latitude && location?.longitude) {
      customer.currentLocation = {
        type: "Point",
        coordinates: [location.longitude, location.latitude],
      };
    }

    await customer.save();

    return res.status(200).json({
      message: "Address updated successfully.",
      addresses: customer.addresses,
    });
  } catch (error) {
    console.error("updateAddress error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── Logout ─────────────────────────────────────────────────────────────────
/**
 * POST /api/customer/auth/logout
 */
export const logout = (req, res) => {
  res.clearCookie("customer_token");
  return res.status(200).json({ message: "Logged out successfully." });
};
