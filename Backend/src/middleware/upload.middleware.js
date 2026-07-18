import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";

// ─── Multer — memory storage ──────────────────────────────────────────────────
// Files stay in RAM as Buffer objects (req.file.buffer).
// React Native sends multipart/form-data with binary blobs — no disk writes needed.

const storage = multer.memoryStorage();

/**
 * imageFilter — used by legacy KYC routes (images only)
 * Allows JPEG, PNG and WEBP. PDF not allowed for legacy endpoints.
 */
const imageFilter = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG and WEBP images are allowed."), false);
  }
};

/**
 * documentFilter — used by the new dynamic verification upload endpoint.
 * Accepts images AND PDF. The controller performs the final MIME type check
 * against the specific DocumentType's acceptedFileTypes list.
 * Multer only rejects truly unknown/unsafe types here as a first defence.
 */
const documentFilter = (_req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Unsupported file type. Allowed types: JPEG, PNG, WEBP, PDF."
      ),
      false
    );
  }
};

/**
 * upload — legacy multer instance (images only, 5 MB)
 * Used by existing KYC routes that are not yet migrated.
 *
 * upload.single("fieldName")   — single image upload
 * upload.fields([...])         — multiple named fields
 * upload.array("fieldName", n) — up to n files under one field
 */
export const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
  },
});

/**
 * uploadDocument — multer instance for the new dynamic document upload endpoint.
 *
 * Allows images + PDF. File size ceiling set to 50 MB (the max allowed
 * by DocumentType.maxFileSizeMB). The controller enforces the per-type
 * limit after loading the DocumentType config.
 *
 * uploadDocument.single("file") — used by POST /api/partner/documents
 */
export const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB ceiling — per-type limit enforced in controller
  },
});

// ─── Cloudinary stream upload helper ─────────────────────────────────────────

/**
 * Uploads a buffer to Cloudinary via a readable stream.
 *
 * @param {Buffer} buffer     - File buffer (req.file.buffer or req.files[field][0].buffer)
 * @param {string} folder     - Cloudinary folder path e.g. "partners/kyc"
 * @param {string} [publicId] - Optional custom public_id
 * @returns {Promise<{ url, publicId, width, height, format }>}
 */
export const uploadToCloudinary = (buffer, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const options = {
      folder,
      resource_type: "image",
      ...(publicId && { public_id: publicId }),
    };

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve({
        url:      result.secure_url,
        publicId: result.public_id,
        width:    result.width,
        height:   result.height,
        format:   result.format,
      });
    });

    streamifier.createReadStream(buffer).pipe(stream);
  });
};
