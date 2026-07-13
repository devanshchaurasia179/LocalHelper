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

export type Customer = {
  id: string;
  phone: string;
  name: string | null;
  gender: string | null;
  addresses: {
    label?: string;
    house?: string;
    street?: string;
    locality?: string;
    city: string;
    state: string;
    pincode: string;
  }[];
  phoneVerified: boolean;
  isOnboarded: boolean;
};

type AuthStatus = "loading" | "unauthenticated" | "authenticated";

type AuthContextType = {
  customer: Customer | null;
  status: AuthStatus;

  // Step 1 – request OTP
  requestOtp: (phone: string) => Promise<void>;

  // Step 2 – verify OTP → sets cookie + customer state
  confirmOtp: (phone: string, otp: string) => Promise<Customer>;

  // Step 3 – complete profile after first login
  finishProfile: (data: {
    name: string;
    gender: string;
    address: {
      label?: string;
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

  // Patch customer fields in context (used by screens after API calls)
  patchCustomer: (fields: Partial<Customer>) => void;

  // Sign out
  signOut: () => Promise<void>;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  /**
   * On mount – ping /customer/auth/me to restore session from the
   * httpOnly cookie. The cookie is sent automatically (withCredentials: true).
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await api.get("/customer/auth/me");
        setCustomer(res.data.customer);
        setStatus("authenticated");
      } catch {
        // 401 → no valid cookie → not logged in
        setStatus("unauthenticated");
      }
    };

    restoreSession();
  }, []);

  // Step 1 ── fire OTP, no state change needed
  const requestOtp = useCallback(async (phone: string) => {
    const res = await sendOtp(phone);
    return res.data; // returns { message, otp } in dev mode
  }, []);

  // Step 2 ── verify OTP; backend sets httpOnly cookie on success
  const confirmOtp = useCallback(
    async (phone: string, otp: string): Promise<Customer> => {
      const res = await verifyOtp(phone, otp);
      const { customer: customerData } = res.data;

      setCustomer(customerData);
      setStatus("authenticated");
      return customerData;
    },
    []
  );

  // Step 3 ── complete profile / onboarding
  const finishProfile = useCallback(
    async (data: {
      name: string;
      gender: string;
      address: {
        label?: string;
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
      setCustomer((prev) =>
        prev ? { ...prev, ...res.data.customer } : prev
      );
    },
    []
  );

  // Sign out ── clears httpOnly cookie on server, resets local state
  const signOut = useCallback(async () => {
    await logout();
    setCustomer(null);
    setStatus("unauthenticated");
  }, []);

  // Patch individual customer fields (e.g. isOnboarded after profile step)
  const patchCustomer = useCallback((fields: Partial<Customer>) => {
    setCustomer((prev) => (prev ? { ...prev, ...fields } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        customer,
        status,
        requestOtp,
        confirmOtp,
        finishProfile,
        patchCustomer,
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
