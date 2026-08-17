import axios from "axios";
import Constants from "expo-constants";

const devHost = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
export const BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? `http://${devHost}:5001/api`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 8000,
  withCredentials: true,
});

export interface CallResponse {
  success: boolean;
  message?: string;
  call?: {
    id: string;
    roomName: string;
    status: string;
  };
  livekit?: {
    url: string;
    token: string;
  };
}

/**
 * Partner accepts an incoming call
 */
export const acceptCall = async (callId: string): Promise<CallResponse> => {
  const response = await api.post<CallResponse>(`/calls/${callId}/accept`);
  return response.data;
};

/**
 * Partner rejects an incoming call
 */
export const rejectCall = async (
  callId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(`/calls/${callId}/reject`);
  return response.data;
};

/**
 * End an ongoing call
 */
export const endCall = async (
  callId: string
): Promise<{ success: boolean; message: string; call?: { id: string; status: string; duration: number } }> => {
  const response = await api.post(`/calls/${callId}/end`);
  return response.data;
};

/**
 * Block a customer from calling
 */
export const blockCustomer = async (
  customerId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(`/calls/block/customer/${customerId}`);
  return response.data;
};

/**
 * Unblock a customer
 */
export const unblockCustomer = async (
  customerId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/calls/block/customer/${customerId}`);
  return response.data;
};
