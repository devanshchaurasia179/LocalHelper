// ─── Customer Model ───────────────────────────────────────────────────────────

export type CustomerAddress = {
  label?: string;
  house?: string;
  street?: string;
  locality?: string;
  city: string;
  state: string;
  pincode: string;
};

export type Customer = {
  id: string;
  phone: string;
  name: string | null;
  gender: string | null;
  addresses: CustomerAddress[];
  phoneVerified: boolean;
  isOnboarded: boolean;
};

// ─── Auth State ───────────────────────────────────────────────────────────────

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

// ─── API Payloads ─────────────────────────────────────────────────────────────

export type SendOtpResponse = {
  message: string;
  otp?: string; // dev mode only
};

export type VerifyOtpResponse = {
  message: string;
  customer: Customer;
};

export type CompleteProfilePayload = {
  name: string;
  gender: string;
  address: CustomerAddress;
  location?: {
    latitude: number;
    longitude: number;
  };
};

export type CompleteProfileResponse = {
  message: string;
  customer: Customer;
};

export type GetMeResponse = {
  customer: Customer;
};
