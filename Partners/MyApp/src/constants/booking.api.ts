import { api } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Booking = {
  _id: string;
  status: BookingStatus;
  isEmergency: boolean;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  description?: string;
  visitingCredit?: number;
  customer: {
    _id: string;
    name: string;
    phone: string;
  };
  category?: {
    _id: string;
    name: string;
  };
  serviceAddress?: {
    house?: string;
    street?: string;
    locality?: string;
    city: string;
    state: string;
    pincode?: string;
  };
  cancellation?: {
    cancelledBy: "customer" | "partner";
    reason?: string;
    cancelledAt: string;
  };
  review?: {
    rating: number;
    comment?: string;
    createdAt: string;
  };
  createdAt: string;
};

export type BookingsResponse = {
  bookings: Booking[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
};

// GET /api/bookings/partner?status=&page=&limit=
export const getPartnerBookings = (params?: {
  status?: BookingStatus;
  page?: number;
  limit?: number;
}) => api.get<BookingsResponse>("/bookings/partner", { params });

// PATCH /api/bookings/:id/accept
export const acceptBooking = (id: string) =>
  api.patch(`/bookings/${id}/accept`);

// PATCH /api/bookings/:id/start
export const startBooking = (id: string) =>
  api.patch(`/bookings/${id}/start`);

// PATCH /api/bookings/:id/complete
export const completeBooking = (id: string) =>
  api.patch(`/bookings/${id}/complete`);

// PATCH /api/bookings/:id/cancel
export const cancelBooking = (id: string, reason?: string) =>
  api.patch(`/bookings/${id}/cancel`, { reason });
