import axios from "axios";
import Constants from "expo-constants";

// On a physical device / Android emulator "localhost" resolves to the device
// itself, not your dev machine. We use the Expo dev-server host so it always
// points to the right machine during development.
const devHost =
  Constants.expoConfig?.hostUri?.split(":")[0] ?? // e.g. "192.168.1.5"
  "localhost";

export const BASE_URL = `http://${devHost}:5001/api`;

console.log("🔥 RUNTIME API URL:", BASE_URL);

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
  withCredentials: true,
});
