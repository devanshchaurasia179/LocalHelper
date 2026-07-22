import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPartnerBookings,
  acceptBooking,
  startBooking,
  completeBooking,
  cancelBooking,
} from "@/api/booking.api";

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const BOOKINGS_KEY = ["partner", "bookings"] as const;
export const pendingBookingsKey = () => [...BOOKINGS_KEY, "pending"] as const;
export const activeBookingsKey = () => [...BOOKINGS_KEY, "active"] as const;

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches pending bookings (awaiting partner acceptance).
 */
export function usePendingBookings(enabled = true) {
  return useQuery({
    queryKey: pendingBookingsKey(),
    queryFn: () => fetchPartnerBookings("pending"),
    enabled,
    refetchInterval: 15_000, // poll every 15s for new requests
  });
}

/**
 * Fetches active bookings (accepted + in_progress).
 */
export function useActiveBookings(enabled = true) {
  return useQuery({
    queryKey: activeBookingsKey(),
    queryFn: async () => {
      const [accepted, inProgress] = await Promise.all([
        fetchPartnerBookings("accepted"),
        fetchPartnerBookings("in_progress"),
      ]);
      return {
        bookings: [...accepted.bookings, ...inProgress.bookings],
        total: accepted.pagination.total + inProgress.pagination.total,
      };
    },
    enabled,
  });
}

/**
 * Fetches all bookings with an optional status filter.
 */
export function usePartnerBookings(status?: string, enabled = true) {
  return useQuery({
    queryKey: [...BOOKINGS_KEY, status ?? "all"],
    queryFn: () => fetchPartnerBookings(status),
    enabled,
  });
}

/**
 * Accept a pending booking.
 */
export function useAcceptBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => acceptBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_KEY });
    },
  });
}

/**
 * Start an accepted booking.
 */
export function useStartBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => startBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_KEY });
    },
  });
}

/**
 * Complete an in-progress booking.
 */
export function useCompleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => completeBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_KEY });
    },
  });
}

/**
 * Cancel a booking.
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      cancelBooking(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_KEY });
    },
  });
}
