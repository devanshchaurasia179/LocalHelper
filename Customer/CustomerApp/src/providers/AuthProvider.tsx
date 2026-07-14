import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { sendOtp, verifyOtp, completeProfile, addAddress as addAddressApi, logout } from "@/api/auth.api";
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

  // Step 1 – request OTP (returns { message, otp? } in dev)
  requestOtp: (phone: string) => Promise<{ message: string; otp?: string }>;

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

  // Add a new address
  addAddress: (address: {
    label?: string;
    house?: string;
    street?: string;
    locality?: string;
    city: string;
    state: string;
    pincode: string;
  }) => Promise<void>;

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
   *
   * A 10-second hard deadline guarantees we never stay stuck in "loading"
   * if the backend is unreachable. Must be > the axios timeout (8 s).
   */
  useEffect(() => {
    let settled = false;

    const finish = (nextStatus: AuthStatus, nextCustomer: Customer | null = null) => {
      if (settled) return;
      settled = true;
      if (nextCustomer) setCustomer(nextCustomer);
      setStatus(nextStatus);
    };

    // Safety net — must be longer than the axios request timeout (8 s in api.ts)
    const timer = setTimeout(() => {
      console.warn("[AuthProvider] /me timed out — falling back to unauthenticated");
      finish("unauthenticated");
    }, 10000);

    const restoreSession = async () => {
      try {
        const res = await api.get("/customer/auth/me");
        console.log("[AuthProvider] /me response:", JSON.stringify(res.data.customer));
        finish("authenticated", res.data.customer);
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
      const updated = res.data.customer;
      console.log("[finishProfile] backend returned:", JSON.stringify(updated));
      setCustomer((prev) => {
        const next = prev
          ? {
              ...prev,
              name:        updated.name        ?? prev.name,
              gender:      updated.gender      ?? prev.gender,
              addresses:   updated.addresses   ?? prev.addresses,
              isOnboarded: updated.isOnboarded ?? prev.isOnboarded,
            }
          : prev;
        console.log("[finishProfile] customer state after update:", JSON.stringify(next));
        return next;
      });
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

  // Add a new address — calls API and appends to local state
  const addAddress = useCallback(
    async (address: {
      label?: string;
      house?: string;
      street?: string;
      locality?: string;
      city: string;
      state: string;
      pincode: string;
    }) => {
      const res = await addAddressApi(address);
      setCustomer((prev) =>
        prev ? { ...prev, addresses: res.data.addresses } : prev
      );
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        customer,
        status,
        requestOtp,
        confirmOtp,
        finishProfile,
        patchCustomer,
        addAddress,
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
