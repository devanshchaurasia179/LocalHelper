/**
 * bookingDeepLink — Partner App
 *
 * A tiny module-level store that bridges push-notification taps to the
 * Bookings screen. The Bookings tab has no per-id route — it's a list — so
 * instead of routing to a nonexistent screen we stash the target here and let
 * the Bookings screen consume it when it mounts / focuses.
 *
 * Flow:
 *   - A booking notification is tapped (background, quit, or foreground).
 *   - The notification handler calls setPendingBooking({ bookingId, action }),
 *     then navigates to the Bookings tab.
 *   - The Bookings screen calls consumePendingBooking() on focus and reveals /
 *     scrolls to that booking.
 *
 * Listeners are supported so a screen that is already mounted/focused reacts
 * immediately instead of only on the next focus.
 */

export type PendingBooking = {
  bookingId: string;
  /** The backend "action" from the data payload, e.g. 'new_request' | 'cancelled'. */
  action?: string;
};

let _pending: PendingBooking | null = null;
const _listeners = new Set<(pending: PendingBooking) => void>();

/** Store a booking to open, and notify any live listener immediately. */
export function setPendingBooking(pending: PendingBooking): void {
  _pending = pending;
  _listeners.forEach((fn) => {
    try {
      fn(pending);
    } catch {
      // A misbehaving listener must never break notification handling.
    }
  });
}

/** Read and clear the pending booking (returns null if none). */
export function consumePendingBooking(): PendingBooking | null {
  const p = _pending;
  _pending = null;
  return p;
}

/**
 * Subscribe to pending-booking events. Returns an unsubscribe function.
 * Used by the Bookings screen so a tap while it's already focused routes at once.
 */
export function subscribePendingBooking(
  listener: (pending: PendingBooking) => void
): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
