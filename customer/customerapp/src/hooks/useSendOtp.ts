import { useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";

/**
 * useSendOtp
 *
 * Encapsulates the "enter phone → send OTP" step.
 * Returns state + handler so the Login screen stays declarative.
 */
export function useSendOtp() {
  const { requestOtp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (phone: string): Promise<boolean> => {
      setError(null);
      setLoading(true);
      try {
        await requestOtp(phone);
        return true;
      } catch (e: any) {
        setError(
          e?.response?.data?.message ?? "Failed to send OTP. Please try again."
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [requestOtp]
  );

  return { send, loading, error, clearError: () => setError(null) };
}
