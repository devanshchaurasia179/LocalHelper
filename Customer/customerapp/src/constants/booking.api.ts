import { api } from "./api";
import type {
  GetBookingsResponse,
  StatusFilter,
} from "@/app/(tabs)/bookings/bookings.types";

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

// ─── Customer Bookings ────────────────────────────────────────────────────────

// GET /api/bookings/customer  (paginated, optionally filtered by status)
export const fetchCustomerBookings = (
  statusFilter: StatusFilter = "all",
  page = 1,
  limit = 20
): Promise<GetBookingsResponse> => {
  const params: Record<string, string | number> = { page, limit };
  if (statusFilter !== "all") params.status = statusFilter;
  return api
    .get<GetBookingsResponse>("/bookings/customer", { params })
    .then((res) => res.data);
};

// GET /api/bookings/:id
export const fetchBookingById = (id: string) =>
  api.get(`/bookings/${id}`).then((res) => res.data.booking);

// PATCH /api/bookings/:id/cancel
export const cancelBooking = (id: string, reason?: string) =>
  api.patch(`/bookings/${id}/cancel`, { reason }).then((res) => res.data);

// POST /api/bookings/:id/review
export const submitReview = (id: string, rating: number, comment?: string) =>
  api
    .post(`/bookings/${id}/review`, { rating, comment })
    .then((res) => res.data);
