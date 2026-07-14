import { api } from '@/constants/api';
import type { GetBookingsResponse, StatusFilter } from './bookings.types';

// ─── Fetch customer's bookings (paginated, optionally filtered by status) ─────
export async function fetchCustomerBookings(
  statusFilter: StatusFilter = 'all',
  page = 1,
  limit = 20,
): Promise<GetBookingsResponse> {
  const params: Record<string, string | number> = { page, limit };
  if (statusFilter !== 'all') params.status = statusFilter;

  const res = await api.get<GetBookingsResponse>('/bookings/customer', { params });
  return res.data;
}

// ─── Fetch a single booking by ID ─────────────────────────────────────────────
export async function fetchBookingById(id: string) {
  const res = await api.get(`/bookings/${id}`);
  return res.data.booking;
}

// ─── Cancel a booking ─────────────────────────────────────────────────────────
export async function cancelBooking(id: string, reason?: string) {
  const res = await api.patch(`/bookings/${id}/cancel`, { reason });
  return res.data;
}

// ─── Submit a review for a completed booking ──────────────────────────────────
export async function submitReview(
  id: string,
  rating: number,
  comment?: string,
) {
  const res = await api.post(`/bookings/${id}/review`, { rating, comment });
  return res.data;
}
