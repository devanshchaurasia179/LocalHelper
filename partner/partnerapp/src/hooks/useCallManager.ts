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
      console.log('═══════════════════════════════════════════════════════');
      console.log('[CallManager] INCOMING CALL RECEIVED');
      console.log('[CallManager] Data:', JSON.stringify(data, null, 2));
      console.log('═══════════════════════════════════════════════════════');
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
      console.log('[CallManager] Call ended:', data);
      if (!mounted) return;
      
      // Clear active call if it matches
      setActiveCall((current) => {
        if (current?.callId === data.callId) {
          Toast.show({
            type: 'info',
            text1: 'Call Ended',
            text2: `Call duration: ${Math.floor(data.duration / 60)}m ${data.duration % 60}s`,
          });
          return null;
        }
        return current;
      });

      // Also clear incoming call if it matches (customer hung up before we answered)
      setIncomingCall((current) => {
        if (current?.callId === data.callId) return null;
        return current;
      });
    };

    const setupListeners = async () => {
      try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('[CallManager] Setting up socket listeners...');
        // Ensure the socket is connected before attaching listeners
        const socket = await connectChatSocket();
        if (!mounted) return;

        console.log('[CallManager] Socket instance:', {
          id: socket.id,
          connected: socket.connected,
          disconnected: socket.disconnected,
        });

        // Log all socket events for debugging
        socket.onAny((eventName, ...args) => {
          console.log(`[CallManager] Socket event "${eventName}":`, args);
        });

        socket.on('incoming_call', handleIncomingCall);
        socket.on('call_ended', handleCallEnded);

        console.log('[CallManager] Listeners attached for incoming_call and call_ended');
        console.log('[CallManager] Socket rooms:', Array.from(socket.rooms || []));
        console.log('═══════════════════════════════════════════════════════');
      } catch (err) {
        console.warn('[CallManager] Failed to connect socket:', err);
      }
    };

    setupListeners();

    return () => {
      mounted = false;
      const socket = getChatSocket();
      if (socket) {
        socket.off('incoming_call', handleIncomingCall);
        socket.off('call_ended', handleCallEnded);
        socket.offAny(); // Remove the catch-all listener
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
        
        Toast.show({
          type: 'success',
          text1: 'Call Accepted',
          text2: `Connected to ${incomingCall.customerName}`,
        });
      } else {
        throw new Error(response.message || 'Failed to accept call');
      }
    } catch (error: any) {
      console.error('[CallManager] Accept error:', error);
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
      
      Toast.show({
        type: 'info',
        text1: 'Call Declined',
        text2: 'You declined the call',
      });
    } catch (error: any) {
      console.error('[CallManager] Reject error:', error);
      // Still clear the incoming call even if API fails
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
      setActiveCall(null);
      
      Toast.show({
        type: 'info',
        text1: 'Call Ended',
        text2: 'You ended the call',
      });
    } catch (error: any) {
      console.error('[CallManager] End call error:', error);
      // Still clear the active call even if API fails
      setActiveCall(null);
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
