import { useState, useCallback, useEffect } from "react";
import { fetchNearbyServices } from "@/api/nearby.api";
import type { NearbyPartner } from "@/api/nearby.api";
import { nearbyCache } from "@/cache/nearbyCache";

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseNearbyServicesResult {
  services: NearbyPartner[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: (coords?: { lat: number; lng: number }) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useNearbyServices
 *
 * Does NOT send live GPS coordinates to the backend.
 * The backend always uses the customer's saved currentLocation
 * (set when they select or save an address in the Header).
 *
 * This ensures nearby results are always relative to the
 * address the customer explicitly chose, not the device's
 * physical position.
 */
export function useNearbyServices(): UseNearbyServicesResult {
  // Seed from cache so categories appear instantly on re-mount
  const [services, setServices] = useState<NearbyPartner[]>(() => nearbyCache.getPartners());
  // Only show loading spinner when there's genuinely nothing to show
  const [loading, setLoading] = useState(() => nearbyCache.getPartners().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Core fetch ──────────────────────────────────────────────────────────────

  const load = useCallback(async (coords?: { lat: number; lng: number }) => {
    try {
      setError(null);
      // Pass coords directly when available (e.g. after address change) so we
      // don't race against the DB write that updates currentLocation.
      // When no coords are given (initial load / pull-to-refresh without a
      // location change) the backend falls back to currentLocation in the DB.
      const res = await fetchNearbyServices(coords);
      nearbyCache.setPartners(res.data.services);
      setServices(res.data.services);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        "Could not load nearby services. Pull to refresh.";
      setError(msg);
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    // If cache is fresh, skip the fetch entirely
    if (!nearbyCache.isStale() && nearbyCache.getPartners().length > 0) return;

    setLoading(nearbyCache.getPartners().length === 0);
    load().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pull-to-refresh / post-location-change refresh ────────────────────────

  const refresh = useCallback(async (coords?: { lat: number; lng: number }) => {
    setRefreshing(true);
    await load(coords);
    setRefreshing(false);
  }, [load]);

  return { services, loading, refreshing, error, refresh };
}
