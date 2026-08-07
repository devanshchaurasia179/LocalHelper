/**
 * nearbyCache.ts
 *
 * In-memory cache shared between the Dashboard and the category screen.
 * - Avoids duplicate GPS calls (the single biggest source of delay)
 * - Allows the category screen to show pre-filtered partners immediately
 *   instead of waiting for a fresh network round-trip
 */

import type { NearbyPartner } from '@/api/nearby.api';

interface LocationCoords {
  lat: number;
  lng: number;
}

let _coords: LocationCoords | null = null;
let _partners: NearbyPartner[] = [];
let _fetchedAt: number = 0;

/** How long (ms) before the cache is considered stale for a background refresh */
const STALE_MS = 60_000; // 1 minute

export const nearbyCache = {
  /** Save the GPS coords after a successful location read */
  setCoords(coords: LocationCoords) {
    _coords = coords;
  },

  /** Return the last known coords, or null if not yet set */
  getCoords(): LocationCoords | null {
    return _coords;
  },

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
};
