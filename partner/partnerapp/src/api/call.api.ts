import { api } from "@/constants/api";

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

export interface CallRecord {
  _id: string;
  customer: {
    _id: string;
    name: string;
    profilePhoto?: string;
    phone?: string;
  };
  partner: string;
  roomName: string;
  status: "ringing" | "accepted" | "rejected" | "missed" | "ongoing" | "completed" | "cancelled" | "failed";
  startedAt: string | null;
  endedAt: string | null;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface CallHistoryResponse {
  success: boolean;
  calls: CallRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Get partner's call history
 */
export const getPartnerCallHistory = async (page = 1, limit = 20): Promise<CallHistoryResponse> => {
  const response = await api.get<CallHistoryResponse>(`/calls/history/partner`, {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Partner initiates a call to a customer
 */
export const createCallAsPartner = async (customerId: string): Promise<CallResponse> => {
  const response = await api.post<CallResponse>(`/calls/partner`, { customerId });
  return response.data;
};

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
