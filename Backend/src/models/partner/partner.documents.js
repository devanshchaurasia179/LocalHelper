// Reusable sub-schema for any Cloudinary-hosted image
const cloudinaryImageSchema = {
  url:      { type: String },
  publicId: { type: String },
  width:    { type: Number },
  height:   { type: Number },
  format:   { type: String },
};

// KYC Documents fields
const documentFields = {
  aadhaarNumber: String,
  panNumber:     String,
  aadhaarFront:  { type: cloudinaryImageSchema, default: undefined },
  aadhaarBack:   { type: cloudinaryImageSchema, default: undefined },
  panImage:      { type: cloudinaryImageSchema, default: undefined },
  selfie:        { type: cloudinaryImageSchema, default: undefined },
};

export default documentFields;
