import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "@/constants/api";
import { sendOtp, verifyOtp, completeProfile, logout } from "@/api/auth.api";
import type { Partner, CompleteProfilePayload } from "@/types/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthStatus = "loading" | "unauthenticated" | "authenticated";

type AuthContextType = {
  partner: Partner | null;
  status: AuthStatus;

  // Step 1 – request OTP (returns { message, otp? } in dev)
  requestOtp: (phone: string) => Promise<{ message: string; otp?: string }>;

  // Step 2 – verify OTP → sets partner_token cookie + partner state
  confirmOtp: (phone: string, otp: string) => Promise<Partner>;

  // Step 3 – complete profile after first login
  finishProfile: (data: CompleteProfilePayload) => Promise<void>;

  // Patch partner fields in context (used by screens after API calls)
  patchPartner: (fields: Partial<Partner>) => void;

  // Sign out
  signOut: () => Promise<void>;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  /**
   * On mount – ping /partner/auth/me to restore session from the
   * httpOnly partner_token cookie. The cookie is sent automatically
   * (withCredentials: true in api.ts).
   *
   * A 10-second hard deadline guarantees we never stay stuck in "loading"
   * if the backend is unreachable. Must be > the axios timeout (8 s).
   */
  useEffect(() => {
    let settled = false;

    const finish = (
      nextStatus: AuthStatus,
      nextPartner: Partner | null = null
    ) => {
      if (settled) return;
      settled = true;
      if (nextPartner) setPartner(nextPartner);
      setStatus(nextStatus);
    };

    // Safety net — must be longer than the axios request timeout (8 s in api.ts)
    const timer = setTimeout(() => {
      console.warn(
        "[AuthProvider] /me timed out — falling back to unauthenticated"
      );
      finish("unauthenticated");
    }, 10000);

    const restoreSession = async () => {
      try {
        const res = await api.get("/partner/auth/me");
        console.log(
          "[AuthProvider] /me response:",
          JSON.stringify(res.data.partner)
        );
        finish("authenticated", res.data.partner);
      } catch (err: any) {
        // 401 = no valid session; any other error = treat as logged out
        console.log(
          "[AuthProvider] session restore failed:",
          err?.response?.status ?? err?.message
        );
        finish("unauthenticated");
      } finally {
        clearTimeout(timer);
      }
    };

    restoreSession();

    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, []);

  // Step 1 ── fire OTP, no state change needed
  const requestOtp = useCallback(async (phone: string) => {
    const res = await sendOtp(phone);
    return res.data; // returns { message, otp } in dev mode
  }, []);

  // Step 2 ── verify OTP; backend sets partner_token httpOnly cookie on success
  const confirmOtp = useCallback(
    async (phone: string, otp: string): Promise<Partner> => {
      const res = await verifyOtp(phone, otp);
      const { partner: partnerData } = res.data;

      setPartner(partnerData);
      setStatus("authenticated");
      return partnerData;
    },
    []
  );

  // Step 3 ── complete profile / onboarding step 1
  const finishProfile = useCallback(async (data: CompleteProfilePayload) => {
    const res = await completeProfile(data);
    const updated = res.data.partner;
    console.log("[finishProfile] backend returned:", JSON.stringify(updated));
    setPartner((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fullName: updated.fullName ?? prev.fullName,
        isProfile: updated.isProfile ?? prev.isProfile,
        isService: updated.isService ?? prev.isService,
        isDocument: updated.isDocument ?? prev.isDocument,
      };
    });
  }, []);

  // Sign out ── clears partner_token cookie on server, resets local state
  const signOut = useCallback(async () => {
    await logout();
    setPartner(null);
    setStatus("unauthenticated");
  }, []);

  // Patch individual partner fields (e.g. isProfile after onboarding step)
  const patchPartner = useCallback((fields: Partial<Partner>) => {
    setPartner((prev) => (prev ? { ...prev, ...fields } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        partner,
        status,
        requestOtp,
        confirmOtp,
        finishProfile,
        patchPartner,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
