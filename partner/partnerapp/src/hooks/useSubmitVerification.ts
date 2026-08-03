/**
 * useSubmitVerification.ts
 *
 * Mutation hook for POST /partner/verification/submit.
 *
 * Called when the partner taps "Submit for Review" after uploading all docs.
 * On success:
 *   - Updates the cached sessionStatus to "Under Review"
 *   - Invalidates partner status so VerificationGate re-routes automatically
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { submitVerification } from "@/api/verification.api";
import { VERIFICATION_QUERY_KEY } from "@/hooks/useVerification";
import { PARTNER_STATUS_QUERY_KEY } from "@/hooks/usePartnerStatus";
import type { VerificationResponse } from "@/types/verification";

export type SubmitResult =
  | { ok: true;  message: string }
  | { ok: false; message: string; missingDocuments?: string[] };

export function useSubmitVerification() {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (): Promise<SubmitResult> => {
    setIsSubmitting(true);
    try {
      const response = await submitVerification();

      // Patch cache — update sessionStatus and banner
      queryClient.setQueryData<VerificationResponse>(
        VERIFICATION_QUERY_KEY,
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sessionStatus: response.sessionStatus,
            verificationStatus: "Under Review",
            banner: {
              type: "warning",
              title: "Under Review",
              message: "Your documents are being reviewed. This usually takes 24–48 hours.",
            },
          };
        }
      );

      // Invalidate partner status so VerificationGate redirects
      queryClient.invalidateQueries({ queryKey: PARTNER_STATUS_QUERY_KEY });

      return { ok: true, message: response.message };
    } catch (error: any) {
      const data = error?.response?.data;
      return {
        ok: false,
        message: data?.message ?? "Submission failed. Please try again.",
        missingDocuments: data?.missingDocuments,
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [queryClient]);

  return { submit, isSubmitting };
}
