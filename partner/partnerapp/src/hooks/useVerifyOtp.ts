import { useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import type { Partner } from "@/types/auth";

/**
 * useVerifyOtp
 *
 * Encapsulates the "enter 6-digit OTP → verify" step.
 * Returns state + handler so the OTP screen stays declarative.
 */
export function useVerifyOtp() {
  const { confirmOtp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(
    async (phone: string, otp: string): Promise<Partner | null> => {
      setError(null);
      setLoading(true);
      try {
        const partner = await confirmOtp(phone, otp);
        return partner;
      } catch (e: any) {
        setError(
          e?.response?.data?.message ?? "Invalid OTP. Please try again."
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [confirmOtp]
  );

  return { verify, loading, error, clearError: () => setError(null) };
}
