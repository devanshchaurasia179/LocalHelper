import { useState, useEffect, useCallback, useRef } from 'react';
import { connectChatSocket, getChatSocket } from '@/services/chat.socket';
import {
  acceptCallAsCustomer,
  rejectCallAsCustomer,
  endCall as endCallApi,
  initiateCallToPartner,
} from '@/api/call.api';
import { startCallAudio, stopCallAudio } from '@/services/callAudio';
import { subscribePendingCall, consumePendingCall } from '@/services/callDeepLink';
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
  /** true when the customer initiated the call (outbound) */
  isOutbound: boolean;
}

export default function useCallManager() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [processing, setProcessing] = useState(false);
  const mountedRef = useRef(true);

  // ─── Accept incoming call ─────────────────────────────────────────────────
  const acceptCallById = useCallback(async (callId: string, info: IncomingCall) => {
    try {
      setProcessing(true);
      const response = await acceptCallAsCustomer(callId);

      if (response.success && response.livekit) {
        startCallAudio();
        if (mountedRef.current) {
          setActiveCall({
            callId,
            roomName: info.roomName,
            partnerName: info.partnerName,
            livekitUrl: response.livekit.url,
            livekitToken: response.livekit.token,
            isOutbound: false,
          });
          setIncomingCall(null);
        }
      } else {
        throw new Error(response.message || 'Failed to accept call');
      }
    } catch (error: any) {
      stopCallAudio();
      if (mountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Call Failed',
          text2: error?.response?.data?.message || 'Could not accept call',
        });
        setIncomingCall(null);
      }
    } finally {
      if (mountedRef.current) setProcessing(false);
    }
  }, []);

  // ─── Reject incoming call ─────────────────────────────────────────────────
  const rejectCallById = useCallback(async (callId: string) => {
    if (!callId) return;
    if (mountedRef.current) {
      setIncomingCall((c) => (c?.callId === callId ? null : c));
    }
    try {
      await rejectCallAsCustomer(callId);
    } catch {
      // best-effort
    }
  }, []);

  // ─── End active call ──────────────────────────────────────────────────────
  const endCallById = useCallback(async (callId: string) => {
    if (!callId) return;
    stopCallAudio();
    if (mountedRef.current) {
      setActiveCall((c) => (c?.callId === callId ? null : c));
    }
    try {
      await endCallApi(callId);
    } catch {
      // best-effort
    }
  }, []);

  // ─── Customer initiates outbound call to partner ──────────────────────────
  const initiateCall = useCallback(async (partnerId: string, partnerName: string) => {
    if (activeCall || processing) return;

    try {
      setProcessing(true);
      const response = await initiateCallToPartner(partnerId);

      if (response.success && response.livekit && response.call) {
        startCallAudio();
        if (mountedRef.current) {
          setActiveCall({
            callId: response.call.id,
            roomName: response.call.roomName,
            partnerName,
            livekitUrl: response.livekit.url,
            livekitToken: response.livekit.token,
            isOutbound: true,
          });
        }
      } else {
        throw new Error(response.message || 'Failed to initiate call');
      }
    } catch (error: any) {
      stopCallAudio();
      if (mountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Call Failed',
          text2: error?.response?.data?.message || 'Could not start call',
        });
      }
    } finally {
      if (mountedRef.current) setProcessing(false);
    }
  }, [activeCall, processing]);

  // ─── Socket listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Drain any call that arrived via FCM while the app was backgrounded and
    // the user tapped the notification to foreground the app.
    const pending = consumePendingCall();
    if (pending && mountedRef.current) {
      setIncomingCall({
        callId: pending.callId,
        roomName: pending.roomName,
        partnerId: pending.callerId,
        partnerName: pending.callerName,
        timestamp: new Date(),
      });
    }

    // Also subscribe for calls that arrive while the app is running but the
    // CallProvider/useCallManager hasn't received the socket event yet
    // (e.g. brief background while socket was disconnected).
    const unsubPending = subscribePendingCall((p) => {
      if (!mountedRef.current) return;
      setIncomingCall({
        callId: p.callId,
        roomName: p.roomName,
        partnerId: p.callerId,
        partnerName: p.callerName,
        timestamp: new Date(),
      });
    });

    const handleIncomingCall = (data: IncomingCall) => {
      console.log('[CallManager-Customer] incoming_call:', data?.callId);
      if (!mountedRef.current || !data?.callId) return;
      // Don't show incoming modal if already in a call
      if (activeCall) return;
      setIncomingCall(data);
    };

    const handleCallAccepted = (data: any) => {
      // For outbound calls: partner accepted — CallScreen is already visible
      // and handles this event itself via its own socket listener.
      console.log('[CallManager-Customer] call_accepted:', data?.callId);
    };

    const handleCallEnded = (data: { callId: string; duration: number; endedBy: string }) => {
      console.log('[CallManager-Customer] call_ended:', data?.callId);
      if (!mountedRef.current) return;

      stopCallAudio();

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

      setIncomingCall((c) => (c?.callId === data.callId ? null : c));
    };

    const handleCallRejected = (data: { callId: string }) => {
      console.log('[CallManager-Customer] call_rejected:', data?.callId);
      if (!mountedRef.current) return;
      stopCallAudio();

      setActiveCall((current) => {
        if (current?.callId === data.callId) {
          Toast.show({ type: 'info', text1: 'Call Declined', text2: 'Partner declined your call' });
          return null;
        }
        return current;
      });

      setIncomingCall((c) => (c?.callId === data.callId ? null : c));
    };

    const attachListeners = (socket: any) => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_rejected', handleCallRejected);
      socket.on('incoming_call', handleIncomingCall);
      socket.on('call_accepted', handleCallAccepted);
      socket.on('call_ended', handleCallEnded);
      socket.on('call_rejected', handleCallRejected);
      console.log('[CallManager-Customer] listeners attached, connected:', socket.connected);
    };

    const setup = async () => {
      try {
        const socket = await connectChatSocket();
        if (!mountedRef.current) return;
        attachListeners(socket);
        socket.on('connect', () => {
          console.log('[CallManager-Customer] reconnected:', socket.id);
          attachListeners(socket);
        });
      } catch (err) {
        console.warn('[CallManager-Customer] socket setup failed, retrying in 3s:', err);
        if (mountedRef.current) {
          setTimeout(() => { if (mountedRef.current) setup(); }, 3000);
        }
      }
    };

    setup();

    return () => {
      mountedRef.current = false;
      unsubPending();
      const socket = getChatSocket();
      if (socket) {
        socket.off('incoming_call', handleIncomingCall);
        socket.off('call_accepted', handleCallAccepted);
        socket.off('call_ended', handleCallEnded);
        socket.off('call_rejected', handleCallRejected);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── JS modal handlers ────────────────────────────────────────────────────
  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall || processing) return;
    await acceptCallById(incomingCall.callId, incomingCall);
  }, [incomingCall, processing, acceptCallById]);

  const handleRejectCall = useCallback(async () => {
    if (!incomingCall || processing) return;
    await rejectCallById(incomingCall.callId);
  }, [incomingCall, processing, rejectCallById]);

  const handleEndCall = useCallback(async () => {
    if (!activeCall) return;
    await endCallById(activeCall.callId);
  }, [activeCall, endCallById]);

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
