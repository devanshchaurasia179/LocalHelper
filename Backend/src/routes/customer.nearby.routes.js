import express from "express";
import { getNearbyServices } from "../controllers/customer.nearby.controller.js";
import protectCustomer from "../middleware/customer.auth.middleware.js";

const router = express.Router();

// Protected — customer must be logged in
router.get("/nearby", protectCustomer, getNearbyServices);

export default router;
