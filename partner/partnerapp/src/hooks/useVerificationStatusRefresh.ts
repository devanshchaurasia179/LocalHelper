import { useCallback, useEffect } from "react";
import { useRouter } from "expo-router";

import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import { VERIFICATION_STATUS } from "@/constants/verificationStatus";
import { ROUTES } from "@/constants/routes";

type Options = {
  /** Poll interval in ms — e.g. 45_000 on the under-review screen */
  pollIntervalMs?: number | false;
  /** Prevents redirect loops when already on the matching verification screen */
  screen?: "under-review" | "rejected";
};

/**
 * Fetches partner verification status, exposes refresh helpers,
 * and navigates automatically when status changes away from the current screen.
 */
export function useVerificationStatusRefresh(options: Options = {}) {
  const router = useRouter();
  const { screen, pollIntervalMs = false } = options;
  const query = usePartnerStatus({
    refetchInterval: pollIntervalMs,
  });

  const status = query.data?.verification.status;

  useEffect(() => {
    if (!status) return;

    switch (status) {
      case VERIFICATION_STATUS.VERIFIED:
        router.replace(ROUTES.APP.HOME as any);
        break;
      case VERIFICATION_STATUS.REJECTED:
        if (screen !== "rejected") {
          router.replace(ROUTES.VERIFICATION.REJECTED as any);
        }
        break;
      case VERIFICATION_STATUS.NOT_SUBMITTED:
        router.replace(ROUTES.ONBOARDING.DOCUMENTS as any);
        break;
      case VERIFICATION_STATUS.UNDER_REVIEW:
        if (screen !== "under-review") {
          router.replace(ROUTES.VERIFICATION.UNDER_REVIEW as any);
        }
        break;
    }
  }, [status, router, screen]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  return {
    profile: query.data,
    status,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh,
  };
}
