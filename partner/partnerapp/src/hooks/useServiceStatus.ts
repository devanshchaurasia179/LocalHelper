/**
 * useServiceStatus.ts
 *
 * Hooks for fetching partner service details and toggling online/offline status.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchServiceDetails,
  updateAvailability,
  fetchDashboardStats,
  type ServiceDetails,
} from "@/api/service.api";

export const SERVICE_QUERY_KEY = ["partner", "service"] as const;
export const DASHBOARD_STATS_KEY = ["partner", "dashboard"] as const;

/**
 * Fetches the partner's service details (includes isOnline, isAvailable).
 */
export function useServiceStatus(enabled = true) {
  return useQuery({
    queryKey: SERVICE_QUERY_KEY,
    queryFn: fetchServiceDetails,
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Toggles the partner's online/offline status.
 * Optimistically updates the cache for instant UI feedback.
 */
export function useToggleOnline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isOnline: boolean) => updateAvailability({ isOnline }),
    onMutate: async (isOnline) => {
      // Cancel in-flight queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: SERVICE_QUERY_KEY });

      // Snapshot the current data for rollback
      const previous = queryClient.getQueryData<ServiceDetails>(SERVICE_QUERY_KEY);

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<ServiceDetails>(SERVICE_QUERY_KEY, {
          ...previous,
          isOnline,
        });
      }

      return { previous };
    },
    onError: (_err, _isOnline, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(SERVICE_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SERVICE_QUERY_KEY });
    },
  });
}


/**
 * Fetches dashboard stats (today's bookings, earnings, rating).
 */
export function useDashboardStats(enabled = true) {
  return useQuery({
    queryKey: DASHBOARD_STATS_KEY,
    queryFn: fetchDashboardStats,
    enabled,
    staleTime: 60_000, // refresh every minute
  });
}
