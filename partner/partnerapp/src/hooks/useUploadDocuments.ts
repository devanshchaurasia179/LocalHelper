import { useState, useCallback } from "react";
import { api } from "@/constants/api";
import { useAuth } from "@/providers/AuthProvider";

export type KycPayload = {
  aadhaarNumber: string;
  aadhaarFront: string; // base64 data URI
  aadhaarBack: string;  // base64 data URI
  panNumber?: string;
  panImage?: string;    // base64 data URI
};

/**
 * useUploadDocuments
 *
 * Encapsulates the KYC document submission step (onboarding step 3).
 * Mirrors the useCompleteProfile / useSendOtp pattern.
 */
export function useUploadDocuments() {
  const { patchPartner } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (payload: KycPayload): Promise<boolean> => {
      setError(null);
      setLoading(true);
      try {
        await api.put("/partner/documents/kyc", payload);
        patchPartner({ isDocument: true });
        return true;
      } catch (e: any) {
        setError(
          e?.response?.data?.message ??
            "Failed to submit documents. Please try again."
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [patchPartner]
  );

  return { submit, loading, error, clearError: () => setError(null) };
}
