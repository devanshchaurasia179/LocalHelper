import { api } from "./api";

// PUT /partner/service/setup
export const setupService = (data: {
  categories: string[];
  skills: string[];
  experience?: number;
  languages?: string[];
  bio?: string;
  visitingCredits: number;       // ₹ charged to visit the customer
  emergencyAvailable?: boolean;
  serviceRadius?: number;
  serviceLocation?: { longitude: number; latitude: number };
  workingDays?: { day: string; startTime: string; endTime: string }[];
}) => api.put("/partner/service/setup", data);

// GET /partner/service
export const getServiceDetails = () => api.get("/partner/service");

// PATCH /partner/service/availability
export const updateAvailability = (data: {
  isOnline?: boolean;
  isAvailable?: boolean;
}) => api.patch("/partner/service/availability", data);

// PATCH /partner/service/visiting-credits
export const updateVisitingCredits = (visitingCredits: number) =>
  api.patch("/partner/service/visiting-credits", { visitingCredits });
