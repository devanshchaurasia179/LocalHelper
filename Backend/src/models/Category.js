import mongoose from "mongoose";

const subcategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String, // MaterialCommunityIcons glyph name
    },
    // Uploaded image (Cloudinary) shown in the customer app
    image: {
      url: { type: String },
      publicId: { type: String },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String, // URL or icon name
    },
    subcategories: [subcategorySchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
