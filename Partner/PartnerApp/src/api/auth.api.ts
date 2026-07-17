import { api } from "@/constants/api";
import type {
  SendOtpResponse,
  VerifyOtpResponse,
  CompleteProfilePayload,
  CompleteProfileResponse,
  GetMeResponse,
} from "@/types/auth";

// ─── Step 1 : Send OTP ────────────────────────────────────────────────────────
// POST /api/partner/auth/send-otp
export const sendOtp = (phone: string) =>
  api.post<SendOtpResponse>("/partner/auth/send-otp", { phone });

// ─── Step 2 : Verify OTP ─────────────────────────────────────────────────────
// POST /api/partner/auth/verify-otp
// Backend sets an httpOnly `partner_token` cookie on success.
export const verifyOtp = (phone: string, otp: string) =>
  api.post<VerifyOtpResponse>("/partner/auth/verify-otp", { phone, otp });

// ─── Step 3 : Complete Profile ────────────────────────────────────────────────
// PUT /api/partner/auth/complete-profile   (requires partner_token cookie)
export const completeProfile = (data: CompleteProfilePayload) =>
  api.put<CompleteProfileResponse>("/partner/auth/complete-profile", data);

// ─── Session Restore ──────────────────────────────────────────────────────────
// GET /api/partner/auth/me   (requires partner_token cookie)
export const getMe = () => api.get<GetMeResponse>("/partner/auth/me");

// ─── Logout ───────────────────────────────────────────────────────────────────
// POST /api/partner/auth/logout   (requires partner_token cookie — clears it server-side)
export const logout = () => api.post("/partner/auth/logout");
