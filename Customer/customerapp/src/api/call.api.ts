import { api } from '@/constants/api';

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
  customer: string;
  partner: {
    _id: string;
    fullName: string;
    profilePhoto?: string;
    phone?: string;
  };
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
 * Get customer's call history
 */
export const getCustomerCallHistory = async (page = 1, limit = 20): Promise<CallHistoryResponse> => {
  const response = await api.get<CallHistoryResponse>('/calls/history/customer', {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Get customer's current call balance.
 */
export interface CallBalanceResponse {
  success: boolean;
  callBalance: number; // seconds
  callBalanceMinutes: number;
  partner?: {
    _id: string;
    fullName: string;
    profilePhoto: string | null;
  } | null;
  rate: {
    amount: number;
    minutes: number;
    description: string;
  };
}

export const getCallBalance = async (): Promise<CallBalanceResponse> => {
  const response = await api.get<CallBalanceResponse>('/calls/balance');
  return response.data;
};

/**
 * Get the customer's current active call (ringing/accepted/ongoing).
 * Returns null if no active call.
 */
export interface ActiveCallInfo {
  _id: string;
  partner: {
    _id: string;
    fullName: string;
    profilePhoto: string | null;
  };
  status: 'ringing' | 'accepted' | 'ongoing';
  allowedTime: number | null; // total seconds allowed
  startedAt: string | null;   // ISO date or null if still ringing
  createdAt: string;
}

export interface ActiveCallResponse {
  success: boolean;
  activeCall: ActiveCallInfo | null;
}

export const getActiveCall = async (): Promise<ActiveCallResponse> => {
  const response = await api.get<ActiveCallResponse>('/calls/active');
  return response.data;
};

/**
 * Customer initiates a call to a partner.
 * Auth is handled via cookies (withCredentials: true on the api instance).
 */
export const initiateCallToPartner = async (
  partnerId: string
): Promise<CallResponse> => {
  const response = await api.post<CallResponse>('/calls', { partnerId });
  return response.data;
};

/**
 * Block a partner from calling
 */
export const blockPartner = async (
  partnerId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(`/calls/block/partner/${partnerId}`, {});
  return response.data;
};

/**
 * Unblock a partner
 */
export const unblockPartner = async (
  partnerId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/calls/block/partner/${partnerId}`);
  return response.data;
};

export interface BlockedPartner {
  _id: string;
  fullName: string;
  profilePhoto?: string;
  phone?: string;
}

/**
 * Get list of blocked partners
 */
export const getBlockedPartners = async (): Promise<{
  success: boolean;
  blockedPartners: BlockedPartner[];
}> => {
  const response = await api.get('/calls/blocked-partners');
  return response.data;
};

/**
 * Customer accepts an incoming call (from partner).
 */
export const acceptCallAsCustomer = async (callId: string): Promise<CallResponse> => {
  const response = await api.post<CallResponse>(`/calls/${callId}/accept-customer`);
  return response.data;
};

/**
 * Customer rejects an incoming call (from partner).
 */
export const rejectCallAsCustomer = async (
  callId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(`/calls/${callId}/reject-customer`);
  return response.data;
};

/**
 * End an ongoing call.
 */
export const endCall = async (
  callId: string
): Promise<{ success: boolean; message: string; call?: { id: string; status: string; duration: number } }> => {
  const response = await api.post(`/calls/${callId}/end`);
  return response.data;
};
