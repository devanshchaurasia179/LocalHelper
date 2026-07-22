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
  selfieUrl?: string;
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

// ─── Active Bookings (for blocking re-booking) ───────────────────────────────

export type ActiveBookingInfo = {
  partnerId: string;
  status: "pending" | "accepted" | "in_progress";
};

/**
 * Fetches all non-terminal bookings (pending, accepted, in_progress)
 * and returns a map of partnerId → booking status.
 * Used by the nearby partners screen to prevent re-booking.
 */
export const fetchActiveBookingsByPartner = async (): Promise<
  Map<string, ActiveBookingInfo["status"]>
> => {
  const statuses: ActiveBookingInfo["status"][] = [
    "pending",
    "accepted",
    "in_progress",
  ];

  const results = await Promise.all(
    statuses.map((status) =>
      api
        .get<GetBookingsResponse>("/bookings/customer", {
          params: { status, page: 1, limit: 100 },
        })
        .then((res) => res.data.bookings.map((b) => ({ partnerId: b.partner._id, status })))
    )
  );

  const map = new Map<string, ActiveBookingInfo["status"]>();
  for (const list of results) {
    for (const { partnerId, status } of list) {
      // Priority: in_progress > accepted > pending
      const existing = map.get(partnerId);
      if (!existing || statusPriority(status) > statusPriority(existing)) {
        map.set(partnerId, status);
      }
    }
  }
  return map;
};

function statusPriority(s: ActiveBookingInfo["status"]): number {
  switch (s) {
    case "in_progress":
      return 3;
    case "accepted":
      return 2;
    case "pending":
      return 1;
    default:
      return 0;
  }
}
