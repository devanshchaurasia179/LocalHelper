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
