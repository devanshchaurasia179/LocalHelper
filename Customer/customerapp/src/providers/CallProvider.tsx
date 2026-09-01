import React, { createContext, useContext, useEffect } from 'react';
import useCallManager from '@/hooks/useCallManager';
import IncomingCallModal from '@/components/call/IncomingCallModal';
import IncomingCallScreen from '@/components/call/IncomingCallScreen';
import CallScreen from '@/components/call/CallScreen';
import Toast from 'react-native-toast-message';
import { connectChatSocket } from '@/services/chat.socket';

interface CallContextValue {
  /** Initiate an outbound call from customer to a partner */
  initiateCall: (partnerId: string, partnerName: string) => Promise<void>;
  /** True while a call action (accept/reject/initiate) is in progress */
  processing: boolean;
}

const CallContext = createContext<CallContextValue>({
  initiateCall: async () => {},
  processing: false,
});

export function useCallContext() {
  return useContext(CallContext);
}

interface CallProviderProps {
  children: React.ReactNode;
}

/**
 * CallProvider wraps the authenticated tabs and handles all call UI globally:
 *  - IncomingCallModal: ringing UI when a partner calls the customer
 *  - IncomingCallScreen: active-call UI for accepted incoming calls (partner → customer)
 *  - CallScreen: dialling + active-call UI for outbound calls (customer → partner)
 *
 * Exposes `initiateCall` via context so any screen can start an outbound call.
 */
export function CallProvider({ children }: CallProviderProps) {
  // Connect socket early so call events arrive before any screen is opened.
  useEffect(() => {
    connectChatSocket().catch(() => {});
  }, []);

  const {
    incomingCall,
    activeCall,
    processing,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
    initiateCall,
  } = useCallManager();

  return (
    <CallContext.Provider value={{ initiateCall, processing }}>
      {children}

      {/* ── Incoming call ringing UI (partner → customer) ─────────────────── */}
      {incomingCall && !activeCall && (
        <IncomingCallModal
          visible={true}
          callerName={incomingCall.partnerName}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* ── Active call: accepted INCOMING call (partner called us) ──────── */}
      {activeCall && !activeCall.isOutbound && (
        <IncomingCallScreen
          visible={true}
          callId={activeCall.callId}
          partnerName={activeCall.partnerName}
          livekitUrl={activeCall.livekitUrl}
          livekitToken={activeCall.livekitToken}
          onEndCall={handleEndCall}
        />
      )}

      {/* ── Active call: OUTBOUND call (customer calling partner) ─────────── */}
      {activeCall && activeCall.isOutbound && (
        <CallScreen
          visible={true}
          callId={activeCall.callId}
          partnerName={activeCall.partnerName}
          livekitUrl={activeCall.livekitUrl}
          livekitToken={activeCall.livekitToken}
          onEndCall={handleEndCall}
        />
      )}

      <Toast />
    </CallContext.Provider>
  );
}
