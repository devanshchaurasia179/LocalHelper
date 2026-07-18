import { useQuery } from "@tanstack/react-query";
import { fetchPartnerMe } from "@/services/partner.api";

export const PARTNER_STATUS_QUERY_KEY = ["partner", "me"] as const;

type Options = {
  enabled?: boolean;
  refetchInterval?: number | false;
};

/**
 * Fetches and caches the partner's verification status via React Query.
 * Used by VerificationGate and verification status screens.
 */
export function usePartnerStatus(options: Options = {}) {
  const { enabled = true, refetchInterval = false } = options;

  return useQuery({
    queryKey: PARTNER_STATUS_QUERY_KEY,
    queryFn: fetchPartnerMe,
    enabled,
    staleTime: 0,
    refetchInterval,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) return false;
      return failureCount < 2;
    },
  });
}
