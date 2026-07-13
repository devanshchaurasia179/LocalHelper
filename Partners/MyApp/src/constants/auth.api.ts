import { api } from "./api";

// POST /partner/auth/send-otp
export const sendOtp = (phone: string) =>
  api.post("/partner/auth/send-otp", { phone });

// POST /partner/auth/verify-otp
export const verifyOtp = (phone: string, otp: string) =>
  api.post("/partner/auth/verify-otp", { phone, otp });

// PUT /partner/auth/complete-profile
export const completeProfile = (data: {
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
}) => api.put("/partner/auth/complete-profile", data);

// GET /partner/auth/me  (session restore on boot)
export const getMe = () => api.get("/partner/auth/me");

// POST /partner/auth/logout
export const logout = () => api.post("/partner/auth/logout");
