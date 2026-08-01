import axios from "axios";
import Constants from "expo-constants";

// In production, use the backend URL from .env (EXPO_PUBLIC_BACKEND_URL).
// In dev, derive the host from the Expo dev-server so it works on physical
// devices and emulators where "localhost" resolves to the device itself.
const devHost =
  Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";

export const BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? `http://${devHost}:5001/api`;

console.log("🔥 RUNTIME API URL:", BASE_URL);

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 8000,
  withCredentials: true, // critical — sends the partner_token httpOnly cookie
});
