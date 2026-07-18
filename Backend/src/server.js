import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./lib/db.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import dns from "dns";

import partnerAuthRoutes from "./routes/partner.auth.routes.js";
import partnerServiceRoutes from "./routes/partner.service.routes.js";
import partnerDocumentRoutes from "./routes/partner.documents.routes.js";
import partnerVerificationRoutes from "./routes/partner.verification.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import customerAuthRoutes from "./routes/customer.auth.routes.js";
import customerNearbyRoutes from "./routes/customer.nearby.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import adminAuthRoutes from "./routes/admin/admin.auth.routes.js";
import adminPartnerRoutes from "./routes/admin/admin.partner.routes.js";
import adminDocumentTypeRoutes from "./routes/admin/admin.documentType.routes.js";
import adminVerificationRoutes from "./routes/admin/admin.verification.routes.js";
import cloudinary from "./config/cloudinary.js";
dotenv.config();

// Change DNS
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const PORT = process.env.PORT;

console.log(cloudinary.config());
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Expo Go, curl, etc.)
        if (!origin) return callback(null, true);

        const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
        const isLAN = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)\d+\.\d+(:\d+)?$/.test(origin);

        if (isLocalhost || isLAN) {
            return callback(null, true);
        }

        callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/partner/auth", partnerAuthRoutes);
app.use("/api/partner/service", partnerServiceRoutes);
app.use("/api/partner/documents", partnerDocumentRoutes);       // old hardcoded routes (kept for backwards compatibility)
app.use("/api/partner/verification", partnerVerificationRoutes); // new dynamic routes
app.use("/api/categories", categoryRoutes);
app.use("/api/customer/auth", customerAuthRoutes);
app.use("/api/customer/services", customerNearbyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin/partners", adminPartnerRoutes);
app.use("/api/admin/document-types", adminDocumentTypeRoutes);
app.use("/api/admin/verification", adminVerificationRoutes);

connectDB();
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
