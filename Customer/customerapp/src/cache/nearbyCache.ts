/**
 * nearbyCache.ts
 *
 * In-memory cache shared between the Dashboard and the category screen.
 * - Avoids duplicate fetches within the stale window
 * - Allows the category screen to show pre-filtered partners immediately
 *   instead of waiting for a fresh network round-trip
 * - Stores the coordinates of the selected address so every screen uses
 *   the same location without an independent GPS round-trip
 */

import type { NearbyPartner } from '@/api/nearby.api';

let _partners: NearbyPartner[] = [];
let _fetchedAt: number = 0;
let _coords: { lat: number; lng: number } | null = null;

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

  /** Filter cached partners by a subcategory ID within a category */
  getPartnersBySubcategory(categoryId: string, subcategoryId: string): NearbyPartner[] {
    return _partners.filter((p) =>
      p.categories.some((c) => c._id === categoryId) &&
      p.subcategories?.some(
        (s) => s.categoryId === categoryId && s.subcategoryId === subcategoryId
      )
    );
  },

  /**
   * Count available partners per subcategory for a given category.
   * Returns a Map: subcategoryId → partner count.
   */
  countPartnersBySubcategory(categoryId: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const p of _partners) {
      if (!p.categories.some((c) => c._id === categoryId)) continue;
      for (const sub of p.subcategories ?? []) {
        if (sub.categoryId === categoryId) {
          counts.set(sub.subcategoryId, (counts.get(sub.subcategoryId) ?? 0) + 1);
        }
      }
    }
    return counts;
  },

  /**
   * Store the coordinates of the selected address.
   * All screens read this instead of requesting live GPS.
   */
  setCoords(coords: { lat: number; lng: number } | null) {
    _coords = coords;
  },

  /**
   * Return the coordinates of the currently selected address,
   * or null if none has been set yet.
   */
  getCoords(): { lat: number; lng: number } | null {
    return _coords;
  },

  /**
   * Bust the cache after a location change (address switch / update).
   * Forces the next fetch to hit the backend with the new address coords.
   * Does NOT clear _coords — the caller passes the new coords explicitly.
   */
  invalidate() {
    _fetchedAt = 0;
  },
};
