import { api } from "./api";

// POST /api/customer/auth/send-otp
export const sendOtp = (phone: string) =>
  api.post("/customer/auth/send-otp", { phone });

// POST /api/customer/auth/verify-otp
export const verifyOtp = (phone: string, otp: string) =>
  api.post("/customer/auth/verify-otp", { phone, otp });

// PUT /api/customer/auth/complete-profile
export const completeProfile = (data: {
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
}) => api.put("/customer/auth/complete-profile", data);

// GET /api/customer/auth/me  (session restore on boot)
export const getMe = () => api.get("/customer/auth/me");

// POST /api/customer/auth/logout
export const logout = () => api.post("/customer/auth/logout");
