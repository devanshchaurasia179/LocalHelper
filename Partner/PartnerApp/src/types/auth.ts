// ─── Partner Model ────────────────────────────────────────────────────────────

export type PartnerAddress = {
  house?: string;
  street?: string;
  locality?: string;
  city: string;
  state: string;
  pincode: string;
};

export type Partner = {
  id: string;
  phone: string;
  fullName: string | null;
  phoneVerified: boolean;
  verificationStatus: "Pending" | "Under Review" | "Approved" | "Rejected";
  // Onboarding progress flags (set to true as each step completes)
  isProfile: boolean;   // personal info + address
  isService: boolean;   // service category + pricing
  isDocument: boolean;  // ID / certification uploads
};

// ─── Auth State ───────────────────────────────────────────────────────────────

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

// ─── API Payloads ─────────────────────────────────────────────────────────────

export type SendOtpResponse = {
  message: string;
  otp?: string; // dev mode only — remove before production
};

export type VerifyOtpResponse = {
  message: string;
  isNewPartner: boolean;
  partner: Partner;
};

export type CompleteProfilePayload = {
  fullName: string;
  gender: string;
  dateOfBirth: string; // ISO 8601 string e.g. "1995-06-15"
  profilePhoto?: string;
  address: PartnerAddress;
  location?: {
    latitude: number;
    longitude: number;
  };
};

export type CompleteProfileResponse = {
  message: string;
  partner: Partner;
};

export type GetMeResponse = {
  partner: Partner;
};
