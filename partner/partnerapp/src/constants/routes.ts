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

  // Main app tabs
  APP: {
    HOME: "/(tabs)/home",
    BOOKINGS: "/(tabs)/bookings",
    PROFILE: "/(tabs)/profile",
  },

  // Root redirect
  ROOT: "/",
} as const;
