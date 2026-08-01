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
import adminCategoryRoutes from "./routes/admin/admin.category.routes.js";
import cloudinary from "./config/cloudinary.js";
dotenv.config();

// Change DNS
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const PORT = process.env.PORT;

console.log(cloudinary.config());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

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
app.use("/api/admin/categories", adminCategoryRoutes);

connectDB();
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
