import { useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import type { CompleteProfilePayload } from "@/types/auth";

/**
 * useCompleteProfile
 *
 * Encapsulates the "complete profile" step (Step 3 of onboarding).
 * Mirrors the useSendOtp / useVerifyOtp pattern.
 */
export function useCompleteProfile() {
  const { finishProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = useCallback(
    async (data: CompleteProfilePayload): Promise<boolean> => {
      setError(null);
      setLoading(true);
      try {
        await finishProfile(data);
        return true;
      } catch (e: any) {
        setError(
          e?.response?.data?.message ??
            "Failed to save profile. Please try again."
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [finishProfile]
  );

  return { complete, loading, error, clearError: () => setError(null) };
}
