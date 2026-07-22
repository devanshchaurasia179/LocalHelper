import express from "express";
import {
  setupService,
  getServiceDetails,
  updateAvailability,
  updateVisitingCredits,
  getDashboardStats,
} from "../controllers/partner.service.controller.js";
import protectPartner from "../middleware/partner.auth.middleware.js";

const router = express.Router();

// All service routes require a valid partner session
router.use(protectPartner);

router.put("/setup", setupService);                          // Initial / update service setup
router.get("/", getServiceDetails);                          // Get current service profile
router.get("/dashboard", getDashboardStats);                 // Home screen stats
router.patch("/availability", updateAvailability);           // Quick online/available toggle
router.patch("/visiting-credits", updateVisitingCredits);   // Quick visiting credits update

export default router;
