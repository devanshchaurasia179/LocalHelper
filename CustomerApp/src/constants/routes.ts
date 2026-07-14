// ─── App Route Constants ──────────────────────────────────────────────────────
// Centralises every route path so strings are never scattered across screens.

export const ROUTES = {
  // Auth group
  AUTH: {
    SEND_OTP: "/(auth)/send-otp",
    VERIFY_OTP: "/(auth)/verify-otp",
  },

  // Onboarding group
  ONBOARDING: {
    PROFILE: "/(onboarding)",
  },

  // Main app tabs
  APP: {
    HOME: "/(tabs)/home",
    ORDERS: "/(tabs)/orders",
    PROFILE: "/(tabs)/profile",
  },

  // Root redirect
  ROOT: "/",
} as const;
