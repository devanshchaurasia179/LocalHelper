import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchCustomerBookings,
  cancelBooking,
  submitReview,
} from "@/constants/booking.api";
import type {
  Booking,
  BookingStatus,
  StatusFilter,
} from "@/app/(tabs)/bookings/bookings.types";

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseBookingsResult {
  // Data
  bookings: Booking[];
  activeFilter: StatusFilter;
  // Loading states
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  // Error
  error: string | null;
  // Actions
  setActiveFilter: (filter: StatusFilter) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  cancelBookingById: (id: string) => Promise<boolean>;
  submitBookingReview: (
    id: string,
    rating: number,
    comment?: string
  ) => Promise<boolean>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useBookings
 *
 * Encapsulates all data-fetching and mutation logic for the Bookings screen:
 *  - Paginated list with filter tabs
 *  - Pull-to-refresh
 *  - Infinite scroll
 *  - Optimistic cancel (updates status locally on success)
 *  - Review submission (patches review into local state on success)
 */
export function useBookings(): UseBookingsResult {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeFilter, setActiveFilterState] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);

  // ── Core fetch ──────────────────────────────────────────────────────────────

  const load = useCallback(
    async (filter: StatusFilter, pageNum: number, append: boolean) => {
      try {
        const data = await fetchCustomerBookings(filter, pageNum);
        setBookings((prev) =>
          append ? [...prev, ...data.bookings] : data.bookings
        );
        totalPagesRef.current = data.pagination.totalPages;
        setError(null);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            "Failed to load bookings. Pull to refresh."
        );
      }
    },
    []
  );

  // ── Filter change → reset page and reload ──────────────────────────────────

  const setActiveFilter = useCallback(
    (filter: StatusFilter) => {
      setActiveFilterState(filter);
      pageRef.current = 1;
      setLoading(true);
      load(filter, 1, false).finally(() => setLoading(false));
    },
    [load]
  );

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    pageRef.current = 1;
    setLoading(true);
    load("all", 1, false).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pull-to-refresh ────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setRefreshing(true);
    pageRef.current = 1;
    await load(activeFilter, 1, false);
    setRefreshing(false);
  }, [activeFilter, load]);

  // ── Infinite scroll ────────────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (loadingMore || pageRef.current >= totalPagesRef.current) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    setLoadingMore(true);
    await load(activeFilter, nextPage, true);
    setLoadingMore(false);
  }, [loadingMore, activeFilter, load]);

  // ── Cancel booking ─────────────────────────────────────────────────────────

  const cancelBookingById = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await cancelBooking(id);
        setBookings((prev) =>
          prev.map((b) =>
            b._id === id ? { ...b, status: "cancelled" as BookingStatus } : b
          )
        );
        return true;
      } catch (err: any) {
        // Bubble error message to caller so the screen can show an Alert
        throw new Error(
          err?.response?.data?.message ?? "Could not cancel booking. Try again."
        );
      }
    },
    []
  );

  // ── Submit review ──────────────────────────────────────────────────────────

  const submitBookingReview = useCallback(
    async (id: string, rating: number, comment?: string): Promise<boolean> => {
      try {
        await submitReview(id, rating, comment);
        setBookings((prev) =>
          prev.map((b) =>
            b._id === id
              ? {
                  ...b,
                  review: {
                    rating,
                    comment: comment ?? "",
                    createdAt: new Date().toISOString(),
                  },
                }
              : b
          )
        );
        return true;
      } catch (err: any) {
        throw new Error(
          err?.response?.data?.message ??
            "Failed to submit review. Try again."
        );
      }
    },
    []
  );

  return {
    bookings,
    activeFilter,
    loading,
    refreshing,
    loadingMore,
    error,
    setActiveFilter,
    refresh,
    loadMore,
    cancelBookingById,
    submitBookingReview,
  };
}
