import { api } from "@/constants/api";
import type {
  SendOtpResponse,
  VerifyOtpResponse,
  CompleteProfilePayload,
  CompleteProfileResponse,
  UpdateProfilePayload,
  UpdateProfileResponse,
  GetMeResponse,
} from "@/types/auth";

// ─── Step 1 : Send OTP ────────────────────────────────────────────────────────
// POST /api/customer/auth/send-otp
export const sendOtp = (phone: string) =>
  api.post<SendOtpResponse>("/customer/auth/send-otp", { phone });

// ─── Step 2 : Verify OTP ─────────────────────────────────────────────────────
// POST /api/customer/auth/verify-otp
// Backend sets an httpOnly `customer_token` cookie on success.
export const verifyOtp = (phone: string, otp: string) =>
  api.post<VerifyOtpResponse>("/customer/auth/verify-otp", { phone, otp });

// ─── Step 3 : Complete Profile ────────────────────────────────────────────────
// PUT /api/customer/auth/complete-profile   (requires cookie)
export const completeProfile = (data: CompleteProfilePayload) =>
  api.put<CompleteProfileResponse>("/customer/auth/complete-profile", data);

// ─── Session Restore ──────────────────────────────────────────────────────────
// GET /api/customer/auth/me   (requires cookie)
export const getMe = () => api.get<GetMeResponse>("/customer/auth/me");

// ─── Logout ───────────────────────────────────────────────────────────────────
// POST /api/customer/auth/logout   (requires cookie – clears it server-side)
export const logout = () => api.post("/customer/auth/logout");

// ─── Update Profile ───────────────────────────────────────────────────────────
// PATCH /api/customer/auth/update-profile   (requires cookie)
export const updateProfileApi = (data: UpdateProfilePayload) =>
  api.patch<UpdateProfileResponse>("/customer/auth/update-profile", data);

// ─── Add Address ──────────────────────────────────────────────────────────────
export const addAddress = (address: {
  label?: string;
  house?: string;
  street?: string;
  locality?: string;
  city: string;
  state: string;
  pincode: string;
}) => api.post("/customer/auth/add-address", address);

// ─── Update Address ───────────────────────────────────────────────────────────
// PATCH /api/customer/auth/update-address/:addressId  (requires cookie)
export const updateAddressApi = (
  addressId: string,
  address: {
    label?: string;
    house?: string;
    street?: string;
    locality?: string;
    city: string;
    state: string;
    pincode: string;
  },
  location?: { latitude: number; longitude: number }
) =>
  api.patch(`/customer/auth/update-address/${addressId}`, {
    ...address,
    ...(location ? { location } : {}),
  });
