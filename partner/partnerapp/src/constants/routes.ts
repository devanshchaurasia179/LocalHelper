// ─── App Route Constants ──────────────────────────────────────────────────────
// Centralises every route path so strings are never scattered across screens.

export const ROUTES = {
  // Auth group
  AUTH: {
    SEND_OTP: "/(auth)/send-otp",
    VERIFY_OTP: "/(auth)/verify-otp",
  },

  // Onboarding group — partner has a 3-step funnel after phone verification
  ONBOARDING: {
    PROFILE: "/(onboarding)/complete-profile",   // Step 1: personal info + address
    SERVICE: "/(onboarding)/add-service",        // Step 2: service category + pricing
    DOCUMENTS: "/(onboarding)/upload-documents", // Step 3: ID + certifications
  },

  // Verification group — shown after KYC upload while admin reviews
  VERIFICATION: {
    UNDER_REVIEW: "/(verification)/under-review",
    REJECTED: "/(verification)/rejected",
  },

  // Account status group — shown when admin blocks or suspends the partner
  ACCOUNT_STATUS: {
    SUSPENDED: "/(account-status)/suspended",
    BLOCKED: "/(account-status)/blocked",
  },

  // Main app tabs
  APP: {
    HOME: "/(tabs)/home",
    WALLET: "/(tabs)/wallet",
    BOOKINGS: "/(tabs)/bookings",
    CHAT: "/(tabs)/chat",
    PROFILE: "/(tabs)/profile",
  },

  // Root redirect (runs VerificationGate after onboarding)
  ROOT: "/",
} as const;
