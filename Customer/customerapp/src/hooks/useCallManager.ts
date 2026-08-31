import { useState, useEffect, useCallback, useRef } from 'react';
import { connectChatSocket, getChatSocket } from '@/services/chat.socket';
import { acceptCallAsCustomer, rejectCallAsCustomer, endCall as endCallApi } from '@/api/call.api';
import { callBridge } from '@/services/callBridge';
import {
  setupCallKeep,
  displayIncomingCall,
  endIncomingCall,
  setCallConnected,
  isCallKeepActive,
} from '@/services/callkeep';
import { startCallAudio, stopCallAudio } from '@/services/callAudio';
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

  // Keep the latest incoming-call payload (from socket) keyed by callId so the
  // CallKeep "answer" event — which only carries the callId — can resolve the
  // room/partner details it needs to accept the call.
  const incomingByIdRef = useRef<Map<string, IncomingCall>>(new Map());
  // Guard against double-accepting the same call from both the JS modal and the
  // native CallKeep "answer" event.
  const acceptingRef = useRef<Set<string>>(new Set());

  // ─── Accept: shared by the JS modal and the native CallKeep answer event ───
  const acceptCallById = useCallback(async (callId: string) => {
    if (!callId || acceptingRef.current.has(callId)) return;
    const info = incomingByIdRef.current.get(callId);
    // Socket details may not have arrived yet (FCM woke us first). Bail; the
    // socket `incoming_call` will re-drive once connected, and CallKeep keeps
    // ringing meanwhile.
    if (!info) return;

    acceptingRef.current.add(callId);
    try {
      setProcessing(true);
      const response = await acceptCallAsCustomer(callId);

      if (response.success && response.livekit) {
        // Native call UI transitions to the in-call state; start audio routing.
        setCallConnected(callId);
        startCallAudio();
        if (mountedRef.current) {
          setActiveCall({
            callId,
            roomName: info.roomName,
            partnerName: info.partnerName,
            livekitUrl: response.livekit.url,
            livekitToken: response.livekit.token,
          });
          setIncomingCall(null);
        }
      } else {
        throw new Error(response.message || 'Failed to accept call');
      }
    } catch (error: any) {
      endIncomingCall(callId);
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
      incomingByIdRef.current.delete(callId);
      acceptingRef.current.delete(callId);
      if (mountedRef.current) setProcessing(false);
    }
  }, []);

  // ─── Reject: shared by the JS modal and the native CallKeep end (ringing) ──
  const rejectCallById = useCallback(async (callId: string) => {
    if (!callId) return;
    endIncomingCall(callId);
    incomingByIdRef.current.delete(callId);
    if (mountedRef.current) {
      setIncomingCall((current) => (current?.callId === callId ? null : current));
    }
    try {
      await rejectCallAsCustomer(callId);
    } catch {
      // Best-effort — the UI is already dismissed.
    }
  }, []);

  // ─── End an active call by id ──────────────────────────────────────────────
  const endCallById = useCallback(async (callId: string) => {
    if (!callId) return;
    endIncomingCall(callId);
    stopCallAudio();
    if (mountedRef.current) {
      setActiveCall((current) => (current?.callId === callId ? null : current));
    }
    try {
      await endCallApi(callId);
    } catch {
      // Already cleared
    }
  }, []);

  // ─── CallKeep native events (answer / end) via the bridge ──────────────────
  useEffect(() => {
    setupCallKeep().catch(() => {});

    // Drain a native "answer" that happened before we mounted (cold start).
    const pending = callBridge.consumePendingAnswer();
    if (pending) {
      // Ensure socket details are on their way, then accept.
      connectChatSocket().catch(() => {});
      acceptCallById(pending);
    }

    const offAnswer = callBridge.on('answer', ({ callId }) => {
      acceptCallById(callId);
    });

    const offEnd = callBridge.on('end', ({ callId, wasRinging }) => {
      // Ringing → reject; already-active → end. If we still have it queued as
      // an incoming call it was never answered, so treat as reject.
      const isIncoming = incomingByIdRef.current.has(callId);
      if (wasRinging || isIncoming) {
        rejectCallById(callId);
      } else {
        endCallById(callId);
      }
    });

    return () => {
      offAnswer();
      offEnd();
    };
  }, [acceptCallById, rejectCallById, endCallById]);

  // ─── Socket call events ────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    const handleIncomingCall = (data: IncomingCall) => {
      console.log('[CallManager-Customer] incoming_call event received:', data?.callId);
      if (!mountedRef.current || !data?.callId) return;

      // Cache details so a native CallKeep answer can resolve the room later.
      incomingByIdRef.current.set(data.callId, data);

      // De-duplicate against the native CallKeep UI. If CallKeep is already
      // showing this call (FCM push arrived), let it own the ringing UI and do
      // NOT also show the JS modal.
      if (isCallKeepActive(data.callId)) {
        return;
      }

      // No native UI yet (e.g. FCM push not delivered while foregrounded) —
      // drive CallKeep ourselves so behaviour is consistent, and keep the JS
      // modal suppressed. If CallKeep can't show (unavailable / no
      // ConnectionService), fall back to the in-app JS modal so the call is
      // never silently dropped — preserving the original foreground path.
      setupCallKeep()
        .then(() => {
          const shown = displayIncomingCall(data.callId, data.partnerName);
          if (!shown && mountedRef.current) setIncomingCall(data);
        })
        .catch(() => {
          if (mountedRef.current) setIncomingCall(data);
        });
    };

    const handleCallEnded = (data: { callId: string; duration: number; endedBy: string }) => {
      console.log('[CallManager-Customer] call_ended event received:', data?.callId);
      if (!mountedRef.current) return;

      endIncomingCall(data.callId);
      stopCallAudio();
      incomingByIdRef.current.delete(data.callId);

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

      setIncomingCall((current) => (current?.callId === data.callId ? null : current));
    };

    const handleCallRejected = (data: { callId: string }) => {
      console.log('[CallManager-Customer] call_rejected event received:', data?.callId);
      if (!mountedRef.current) return;
      endIncomingCall(data.callId);
      incomingByIdRef.current.delete(data.callId);
      setIncomingCall((current) => (current?.callId === data.callId ? null : current));
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

  // ─── JS modal handlers (fallback path when CallKeep is unavailable) ────────
  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall || processing) return;
    await acceptCallById(incomingCall.callId);
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
  };
}
