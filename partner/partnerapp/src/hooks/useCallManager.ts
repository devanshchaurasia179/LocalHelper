import { useState, useEffect, useCallback, useRef } from 'react';
import { connectChatSocket, getChatSocket } from '@/services/chat.socket';
import { acceptCall, rejectCall, endCall as endCallApi, createCallAsPartner } from '@/api/call.api';
import Toast from 'react-native-toast-message';

interface IncomingCall {
  callId: string;
  roomName: string;
  customerId: string;
  customerName: string;
  timestamp: Date;
}

interface ActiveCall {
  callId: string;
  roomName: string;
  customerName: string;
  livekitUrl: string;
  livekitToken: string;
  initiatedByPartner: boolean;
}

export default function useCallManager() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [processing, setProcessing] = useState(false);
  const mountedRef = useRef(true);

  // Listen for incoming calls via socket
  useEffect(() => {
    mountedRef.current = true;

    const handleIncomingCall = (data: IncomingCall) => {
      console.log('[CallManager] incoming_call event received:', data?.callId);
      if (!mountedRef.current) return;
      setIncomingCall(data);
      Toast.show({
        type: 'info',
        text1: 'Incoming Call',
        text2: `${data.customerName} is calling...`,
        visibilityTime: 5000,
      });
    };

    const handleCallEnded = (data: { callId: string; duration: number; endedBy: string }) => {
      console.log('[CallManager] call_ended event received:', data?.callId);
      if (!mountedRef.current) return;

      setActiveCall((current) => {
        if (current?.callId === data.callId) {
          Toast.show({
            type: 'info',
            text1: 'Call Ended',
            text2: `Duration: ${Math.floor(data.duration / 60)}m ${data.duration % 60}s`,
          });
          return null;
        }
        return current;
      });

      // Customer hung up before we answered
      setIncomingCall((current) => {
        if (current?.callId === data.callId) return null;
        return current;
      });
    };

    const handleCallRejected = (data: { callId: string }) => {
      console.log('[CallManager] call_rejected event received:', data?.callId);
      if (!mountedRef.current) return;

      // Customer rejected our outgoing call
      setActiveCall((current) => {
        if (current?.callId === data.callId) {
          Toast.show({
            type: 'info',
            text1: 'Call Declined',
            text2: 'The customer declined your call',
          });
          return null;
        }
        return current;
      });
    };

    const attachListeners = (socket: any) => {
      // Remove any stale listeners to prevent duplicates
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_rejected', handleCallRejected);
      // Attach fresh listeners
      socket.on('incoming_call', handleIncomingCall);
      socket.on('call_ended', handleCallEnded);
      socket.on('call_rejected', handleCallRejected);
      console.log('[CallManager] Listeners attached, socket connected:', socket.connected);
    };

    const setupListeners = async () => {
      try {
        const socket = await connectChatSocket();
        if (!mountedRef.current) return;
        attachListeners(socket);

        // Re-attach on reconnect — after a reconnect, the socket gets a new
        // server-side session but the client instance remains the same.
        // Listeners persist across reconnections in socket.io-client v4+,
        // but we log for debugging visibility.
        socket.on('connect', () => {
          console.log('[CallManager] Socket reconnected, id:', socket.id);
        });
      } catch (err) {
        console.warn('[CallManager] Failed to setup socket listeners, retrying in 3s:', err);
        // Retry after a short delay — covers the race where _connecting fails
        if (mountedRef.current) {
          setTimeout(() => {
            if (mountedRef.current) setupListeners();
          }, 3000);
        }
      }
    };

    setupListeners();

    return () => {
      mountedRef.current = false;
      const socket = getChatSocket();
      if (socket) {
        socket.off('incoming_call', handleIncomingCall);
        socket.off('call_ended', handleCallEnded);
        socket.off('call_rejected', handleCallRejected);
      }
    };
  }, []);

  // Accept incoming call
  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall || processing) return;

    try {
      setProcessing(true);
      const response = await acceptCall(incomingCall.callId);

      if (response.success && response.livekit) {
        setActiveCall({
          callId: incomingCall.callId,
          roomName: incomingCall.roomName,
          customerName: incomingCall.customerName,
          livekitUrl: response.livekit.url,
          livekitToken: response.livekit.token,
          initiatedByPartner: false,
        });
        setIncomingCall(null);
      } else {
        throw new Error(response.message || 'Failed to accept call');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Call Failed',
        text2: error?.response?.data?.message || 'Could not accept call',
      });
      setIncomingCall(null);
    } finally {
      setProcessing(false);
    }
  }, [incomingCall, processing]);

  // Reject incoming call
  const handleRejectCall = useCallback(async () => {
    if (!incomingCall || processing) return;

    try {
      setProcessing(true);
      await rejectCall(incomingCall.callId);
      setIncomingCall(null);
    } catch {
      setIncomingCall(null);
    } finally {
      setProcessing(false);
    }
  }, [incomingCall, processing]);

  // End active call
  const handleEndCall = useCallback(async () => {
    if (!activeCall) return;

    const callId = activeCall.callId;
    setActiveCall(null);

    try {
      await endCallApi(callId);
    } catch {
      // Already cleared
    }
  }, [activeCall]);

  // Partner initiates a call to a customer
  const initiateCall = useCallback(async (customerId: string, customerName: string) => {
    if (activeCall || processing) return;

    try {
      setProcessing(true);
      const response = await createCallAsPartner(customerId);

      if (response.success && response.livekit && response.call) {
        setActiveCall({
          callId: response.call.id,
          roomName: response.call.roomName,
          customerName,
          livekitUrl: response.livekit.url,
          livekitToken: response.livekit.token,
          initiatedByPartner: true,
        });
      } else {
        throw new Error(response.message || 'Failed to initiate call');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Call Failed',
        text2: error?.response?.data?.message || 'Could not initiate call',
      });
    } finally {
      setProcessing(false);
    }
  }, [activeCall, processing]);

  return {
    incomingCall,
    activeCall,
    processing,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
    initiateCall,
  };
}
