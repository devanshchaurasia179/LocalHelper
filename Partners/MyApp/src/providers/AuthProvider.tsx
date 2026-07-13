import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { sendOtp, verifyOtp, completeProfile, logout } from "@/constants/auth.api";
import { api } from "@/constants/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Partner = {
  id: string;
  phone: string;
  fullName: string | null;
  phoneVerified: boolean;
  verificationStatus: "Pending" | "Under Review" | "Approved" | "Rejected";
  isProfile: boolean;
  isService: boolean;
  isDocument: boolean;
};

type AuthStatus = "loading" | "unauthenticated" | "authenticated";

type AuthContextType = {
  partner: Partner | null;
  status: AuthStatus;

  // Step 1 – request OTP
  requestOtp: (phone: string) => Promise<void>;

  // Step 2 – verify OTP  →  sets cookie + partner state
  confirmOtp: (phone: string, otp: string) => Promise<Partner>;

  // Step 3 – finish profile after first login
  finishProfile: (data: {
    fullName: string;
    gender: string;
    dateOfBirth: string;
    profilePhoto?: string;
    address: {
      house?: string;
      street?: string;
      locality?: string;
      city: string;
      state: string;
      pincode: string;
    };
    location?: {
      latitude: number;
      longitude: number;
    };
  }) => Promise<void>;

  // Patch partner fields in context (used by onboarding screens after API calls)
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
   * On mount – ping a protected endpoint to restore session from the
   * httpOnly cookie. The backend cookie is sent automatically by axios
   * (withCredentials: true).
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await api.get("/partner/auth/me");
        setPartner(res.data.partner);
        setStatus("authenticated");
      } catch {
        // 401 means no valid cookie → not logged in
        setStatus("unauthenticated");
      }
    };

    restoreSession();
  }, []);

  // Step 1 ── just fire the OTP, no state change needed
  const requestOtp = useCallback(async (phone: string) => {
    const res = await sendOtp(phone);
    return res.data; // returns { message, otp } in dev mode
  }, []);

  // Step 2 ── verify OTP; backend sets httpOnly cookie on success
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

  // Step 3 ── complete profile after first login
  const finishProfile = useCallback(
    async (data: {
      fullName: string;
      gender: string;
      dateOfBirth: string;
      profilePhoto?: string;
      address: {
        house?: string;
        street?: string;
        locality?: string;
        city: string;
        state: string;
        pincode: string;
      };
      location?: {
        latitude: number;
        longitude: number;
      };
    }) => {
      const res = await completeProfile(data);
      setPartner((prev) =>
        prev ? { ...prev, ...res.data.partner } : prev
      );
    },
    []
  );

  // Sign out ── clears httpOnly cookie on server, resets local state
  const signOut = useCallback(async () => {
    await logout();
    setPartner(null);
    setStatus("unauthenticated");
  }, []);

  // Patch individual partner fields (e.g. isService, isDocument after onboarding steps)
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
