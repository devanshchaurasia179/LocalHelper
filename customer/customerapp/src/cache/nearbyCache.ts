/**
 * nearbyCache.ts
 *
 * In-memory cache shared between the Dashboard and the category screen.
 * - Avoids duplicate fetches within the stale window
 * - Allows the category screen to show pre-filtered partners immediately
 *   instead of waiting for a fresh network round-trip
 *
 * NOTE: We deliberately do NOT cache GPS coordinates here.
 * Nearby results are always based on the customer's selected address
 * (stored as currentLocation on the backend), not the device's live position.
 */

import type { NearbyPartner } from '@/api/nearby.api';

let _partners: NearbyPartner[] = [];
let _fetchedAt: number = 0;

/** How long (ms) before the cache is considered stale for a background refresh */
const STALE_MS = 60_000; // 1 minute

export const nearbyCache = {
  /** Save the full partner list fetched from the API */
  setPartners(partners: NearbyPartner[]) {
    _partners = partners;
    _fetchedAt = Date.now();
  },

  /** Return the cached partners list (may be empty on first launch) */
  getPartners(): NearbyPartner[] {
    return _partners;
  },

  /** True when cached data is older than STALE_MS */
  isStale(): boolean {
    return Date.now() - _fetchedAt > STALE_MS;
  },

  /** Filter cached partners by a category ID */
  getPartnersByCategory(categoryId: string): NearbyPartner[] {
    return _partners.filter((p) =>
      p.categories.some((c) => c._id === categoryId)
    );
  },

  /**
   * Bust the cache after a location change (address switch / update).
   * Forces the next fetch to hit the backend, which will use the
   * updated currentLocation.
   */
  invalidate() {
    _fetchedAt = 0;
  },
};
