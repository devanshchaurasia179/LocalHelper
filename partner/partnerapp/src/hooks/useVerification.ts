/**
 * useVerification.ts
 *
 * React Query hook for GET /partner/verification.
 *
 * Returns the full verification state including documents[], banner, progress.
 * Used by the UploadDocumentsScreen to render the dynamic document list.
 *
 * Query key is exported so other hooks (useDocumentUpload) can invalidate
 * or update the cache after a successful upload.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchVerification } from "@/api/verification.api";
import type { VerificationResponse } from "@/types/verification";

export const VERIFICATION_QUERY_KEY = ["partner", "verification"] as const;

type Options = {
  enabled?: boolean;
};

export function useVerification(options: Options = {}) {
  const { enabled = true } = options;

  return useQuery<VerificationResponse, Error>({
    queryKey: VERIFICATION_QUERY_KEY,
    queryFn: fetchVerification,
    enabled,
    staleTime: 0,          // always re-fetch on mount — status can change anytime
    retry: (failureCount, error) => {
      // Don't retry 401 — session is gone, VerificationGate will redirect
      const status = (error as any)?.response?.status;
      if (status === 401) return false;
      return failureCount < 2;
    },
  });
}
