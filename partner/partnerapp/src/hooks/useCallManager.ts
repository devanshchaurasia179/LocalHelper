import { useState, useEffect, useCallback } from 'react';
import { connectChatSocket, getChatSocket } from '@/services/chat.socket';
import { acceptCall, rejectCall, endCall as endCallApi } from '@/api/call.api';
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
}

export default function useCallManager() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [processing, setProcessing] = useState(false);

  // Listen for incoming calls via socket
  useEffect(() => {
    let mounted = true;

    const handleIncomingCall = (data: IncomingCall) => {
      if (!mounted) return;
      setIncomingCall(data);
      Toast.show({
        type: 'info',
        text1: 'Incoming Call',
        text2: `${data.customerName} is calling...`,
        visibilityTime: 5000,
      });
    };

    const handleCallEnded = (data: { callId: string; duration: number; endedBy: string }) => {
      if (!mounted) return;

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

    const attachListeners = (socket: any) => {
      socket.on('incoming_call', handleIncomingCall);
      socket.on('call_ended', handleCallEnded);
    };

    const setupListeners = async () => {
      try {
        const socket = await connectChatSocket();
        if (!mounted) return;
        attachListeners(socket);

        // Re-attach listeners on reconnect (socket.io preserves event handlers
        // across reconnects on the same instance, but this is defensive)
        socket.on('connect', () => {
          // Socket reconnected — listeners are already attached
        });
      } catch {
        // Socket will retry automatically
      }
    };

    setupListeners();

    return () => {
      mounted = false;
      const socket = getChatSocket();
      if (socket) {
        socket.off('incoming_call', handleIncomingCall);
        socket.off('call_ended', handleCallEnded);
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

    try {
      await endCallApi(activeCall.callId);
    } catch {
      // Clear anyway
    }
    setActiveCall(null);
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
