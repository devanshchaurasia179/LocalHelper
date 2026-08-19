import React, { createContext, useContext, useEffect } from 'react';
import useCallManager from '@/hooks/useCallManager';
import IncomingCallModal from '@/components/call/IncomingCallModal';
import IncomingCallScreen from '@/components/call/IncomingCallScreen';
import Toast from 'react-native-toast-message';
import { connectChatSocket } from '@/services/chat.socket';

interface CallContextValue {
  /** True if currently processing accept/reject */
  processing: boolean;
}

const CallContext = createContext<CallContextValue>({
  processing: false,
});

export function useCallContext() {
  return useContext(CallContext);
}

interface CallProviderProps {
  children: React.ReactNode;
}

/**
 * CallProvider wraps the app and handles incoming calls globally.
 * It shows incoming call modals and active call screens on top of any screen.
 */
export function CallProvider({ children }: CallProviderProps) {
  // Ensure socket is connected as early as possible for receiving calls
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
  } = useCallManager();

  return (
    <CallContext.Provider value={{ processing }}>
      {children}

      {/* Incoming Call Modal */}
      {incomingCall && !activeCall && (
        <IncomingCallModal
          visible={true}
          callerName={incomingCall.partnerName}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Active Call Screen (for accepted incoming calls) */}
      {activeCall && (
        <IncomingCallScreen
          visible={true}
          callId={activeCall.callId}
          partnerName={activeCall.partnerName}
          livekitUrl={activeCall.livekitUrl}
          livekitToken={activeCall.livekitToken}
          onEndCall={handleEndCall}
        />
      )}

      {/* Toast container */}
      <Toast />
    </CallContext.Provider>
  );
}
