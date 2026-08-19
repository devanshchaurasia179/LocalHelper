import { useState, useEffect, useCallback, useRef } from 'react';
import { connectChatSocket, getChatSocket } from '@/services/chat.socket';
import { acceptCallAsCustomer, rejectCallAsCustomer, endCall as endCallApi } from '@/api/call.api';
import Toast from 'react-native-toast-message';

interface IncomingCall {
  callId: string;
  roomName: string;
  partnerId: string;
  partnerName: string;
  timestamp: Date;
}

interface ActiveCall {
  callId: string;
  roomName: string;
  partnerName: string;
  livekitUrl: string;
  livekitToken: string;
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
      console.log('[CallManager-Customer] incoming_call event received:', data?.callId);
      if (!mountedRef.current) return;
      setIncomingCall(data);
      Toast.show({
        type: 'info',
        text1: 'Incoming Call',
        text2: `${data.partnerName} is calling...`,
        visibilityTime: 5000,
      });
    };

    const handleCallEnded = (data: { callId: string; duration: number; endedBy: string }) => {
      console.log('[CallManager-Customer] call_ended event received:', data?.callId);
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

      // Partner hung up before we answered
      setIncomingCall((current) => {
        if (current?.callId === data.callId) return null;
        return current;
      });
    };

    const handleCallRejected = (data: { callId: string }) => {
      console.log('[CallManager-Customer] call_rejected event received:', data?.callId);
      if (!mountedRef.current) return;
      // If this call was ringing, dismiss it
      setIncomingCall((current) => {
        if (current?.callId === data.callId) return null;
        return current;
      });
    };

    const attachListeners = (socket: any) => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_rejected', handleCallRejected);
      socket.on('incoming_call', handleIncomingCall);
      socket.on('call_ended', handleCallEnded);
      socket.on('call_rejected', handleCallRejected);
      console.log('[CallManager-Customer] Listeners attached, socket connected:', socket.connected);
    };

    const setupListeners = async () => {
      try {
        const socket = await connectChatSocket();
        if (!mountedRef.current) return;
        attachListeners(socket);

        socket.on('connect', () => {
          console.log('[CallManager-Customer] Socket reconnected, id:', socket.id);
        });
      } catch (err) {
        console.warn('[CallManager-Customer] Failed to setup socket listeners, retrying in 3s:', err);
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
      const response = await acceptCallAsCustomer(incomingCall.callId);

      if (response.success && response.livekit) {
        setActiveCall({
          callId: incomingCall.callId,
          roomName: incomingCall.roomName,
          partnerName: incomingCall.partnerName,
          livekitUrl: response.livekit.url,
          livekitToken: response.livekit.token,
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
      await rejectCallAsCustomer(incomingCall.callId);
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

  return {
    incomingCall,
    activeCall,
    processing,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
  };
}
