import { useState, useCallback, useEffect } from "react";
import * as Location from "expo-location";
import { fetchNearbyServices } from "@/api/nearby.api";
import type { NearbyPartner } from "@/api/nearby.api";
import { nearbyCache } from "@/cache/nearbyCache";

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseNearbyServicesResult {
  services: NearbyPartner[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useNearbyServices
 *
 * 1. Requests foreground location permission on mount.
 * 2. Passes live lat/lng to the backend when available.
 * 3. Falls back gracefully — backend uses the customer's saved
 *    currentLocation if coordinates are not sent.
 */
export function useNearbyServices(): UseNearbyServicesResult {
  // Seed from cache so categories appear instantly on re-mount
  const [services, setServices] = useState<NearbyPartner[]>(() => nearbyCache.getPartners());
  // Only show loading spinner when there's genuinely nothing to show
  const [loading, setLoading] = useState(() => nearbyCache.getPartners().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Core fetch ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      setError(null);

      // Use cached coords if available — skip GPS entirely
      let coords: { lat: number; lng: number } | undefined = nearbyCache.getCoords() ?? undefined;

      if (!coords) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          nearbyCache.setCoords(coords);
        }
      }

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

  // ── Pull-to-refresh ────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { services, loading, refreshing, error, refresh };
}
