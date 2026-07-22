/**
 * booking.api.ts
 *
 * All HTTP calls for partner booking operations.
 */

import { api } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingCustomer {
  _id: string;
  name?: string;
  phone?: string;
}

export interface BookingCategory {
  _id: string;
  name: string;
}

export interface ServiceAddress {
  house?: string;
  street?: string;
  locality?: string;
  city: string;
  state: string;
  pincode?: string;
}

export interface Booking {
  _id: string;
  partner: string;
  customer: BookingCustomer;
  category?: BookingCategory;
  description?: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  serviceAddress?: ServiceAddress;
  visitingCredit?: number;
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
  isEmergency: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookingsResponse {
  bookings: Booking[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

// ─── GET /api/bookings/partner ────────────────────────────────────────────────

export async function fetchPartnerBookings(
  status?: string,
  page = 1,
  limit = 20
): Promise<BookingsResponse> {
  const params: Record<string, string | number> = { page, limit };
  if (status) params.status = status;

  const res = await api.get<BookingsResponse>("/bookings/partner", { params });
  return res.data;
}

// ─── PATCH /api/bookings/:id/accept ───────────────────────────────────────────

export async function acceptBooking(bookingId: string): Promise<{ message: string }> {
  const res = await api.patch<{ message: string }>(`/bookings/${bookingId}/accept`);
  return res.data;
}

// ─── PATCH /api/bookings/:id/start ────────────────────────────────────────────

export async function startBooking(bookingId: string): Promise<{ message: string }> {
  const res = await api.patch<{ message: string }>(`/bookings/${bookingId}/start`);
  return res.data;
}

// ─── PATCH /api/bookings/:id/complete ─────────────────────────────────────────

export async function completeBooking(bookingId: string): Promise<{ message: string }> {
  const res = await api.patch<{ message: string }>(`/bookings/${bookingId}/complete`);
  return res.data;
}

// ─── PATCH /api/bookings/:id/cancel ───────────────────────────────────────────

export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ message: string }> {
  const res = await api.patch<{ message: string }>(`/bookings/${bookingId}/cancel`, {
    reason,
  });
  return res.data;
}
