import { useState, useCallback } from "react";
import { createBooking } from "@/constants/booking.api";
import type { NearbyPartner } from "@/api/nearby.api";

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseBookPartnerResult {
  booking: boolean;
  error: string | null;
  success: boolean;
  book: (partner: NearbyPartner, opts: BookOptions) => Promise<boolean>;
  reset: () => void;
}

export interface BookOptions {
  scheduledAt: Date;
  categoryId?: string;
  description?: string;
  isEmergency?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useBookPartner
 *
 * Wraps POST /api/bookings with local loading / error / success states.
 * Returns `true` from `book()` on success so callers can close modals.
 */
export function useBookPartner(): UseBookPartnerResult {
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const book = useCallback(
    async (partner: NearbyPartner, opts: BookOptions): Promise<boolean> => {
      setBooking(true);
      setError(null);
      setSuccess(false);

      try {
        await createBooking({
          partnerId: partner._id,
          categoryId: opts.categoryId ?? partner.categories[0]?._id,
          description: opts.description,
          scheduledAt: opts.scheduledAt.toISOString(),
          isEmergency: opts.isEmergency ?? false,
        });

        setSuccess(true);
        return true;
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ?? "Booking failed. Please try again.";
        setError(msg);
        return false;
      } finally {
        setBooking(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return { booking, error, success, book, reset };
}
