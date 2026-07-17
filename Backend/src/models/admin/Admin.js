import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/**
 * Admin Model
 *
 * Three roles:
 *   SUPER_ADMIN — full access including managing other admins
 *   ADMIN       — full platform management (partners, customers, bookings)
 *   SUPPORT     — read-only access for support ticket handling
 *
 * isActive lets us disable an admin without deleting the account.
 * Deleting would break audit trails (who approved which partner, etc.).
 */
const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Admin name is required."],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true, // normalize before storing
      trim: true,
    },

    // Never store plain text passwords.
    // This field holds the bcrypt hash.
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: 6,
      select: false, // NEVER return password in queries by default
    },

    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "SUPPORT"],
      default: "ADMIN",
    },

    // When isActive is false, the admin cannot log in even with valid credentials.
    // Use this to suspend an admin without losing their history.
    isActive: {
      type: Boolean,
      default: true,
    },

    // Updated on every successful login — useful for security audits.
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ─── Pre-save hook: hash password before saving ──────────────────────────────
// This runs automatically whenever admin.save() is called.
// We check isModified so we don't re-hash an already-hashed password
// (e.g., when updating name or role without changing password).
adminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  // saltRounds = 12 → 2^12 = 4096 iterations.
  // Higher = slower to crack, but also slower to hash.
  // 12 is the production-safe standard.
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Instance method: compare plain password with stored hash ────────────────
// Called during login: await admin.comparePassword(req.body.password)
adminSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

export default mongoose.model("Admin", adminSchema);
