import { api } from "./api";

// ─── Categories ───────────────────────────────────────────────────────────────

export type Category = {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
};

// GET /api/categories
export const getCategories = () =>
  api.get<{ categories: Category[] }>("/categories");

// ─── Nearby Partners ──────────────────────────────────────────────────────────

export type NearbyPartner = {
  _id: string;
  fullName: string;
  profilePhoto?: string;
  bio?: string;
  skills?: string[];
  categories: Category[];
  experience?: number;
  languages?: string[];
  visitingCredits?: number;
  emergencyAvailable?: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  workingDays?: string[];
  serviceRadius?: number;
  distanceKm: number;
  averageRating?: number;
  totalReviews?: number;
  completedJobs?: number;
};

// GET /api/customer/services/nearby
export const getNearbyPartners = (params: {
  lng?: number;
  lat?: number;
  categoryId?: string;
  maxRadius?: number;
}) =>
  api.get<{ count: number; services: NearbyPartner[] }>(
    "/customer/services/nearby",
    { params }
  );

// ─── Booking ──────────────────────────────────────────────────────────────────

export type CreateBookingPayload = {
  partnerId: string;
  categoryId?: string;
  description?: string;
  scheduledAt: string; // ISO 8601
  isEmergency?: boolean;
};

// POST /api/bookings
export const createBooking = (data: CreateBookingPayload) =>
  api.post("/bookings", data);
