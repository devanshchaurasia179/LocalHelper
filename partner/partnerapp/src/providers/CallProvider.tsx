import React, { createContext, useContext, useEffect } from 'react';
import useCallManager from '@/hooks/useCallManager';
import IncomingCallModal from '@/components/call/IncomingCallModal';
import CallScreen from '@/components/call/CallScreen';
import Toast from 'react-native-toast-message';
import { connectChatSocket } from '@/services/chat.socket';

interface CallContextValue {
  initiateCall: (customerId: string, customerName: string) => Promise<void>;
  processing: boolean;
}

const CallContext = createContext<CallContextValue>({
  initiateCall: async () => {},
  processing: false,
});

export function useCall() {
  return useContext(CallContext);
}

interface CallProviderProps {
  children: React.ReactNode;
}

/**
 * CallProvider wraps the app and handles incoming calls globally.
 * It shows incoming call modals and active call screens on top of any screen.
 * Also exposes initiateCall via context for outbound calls.
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
    initiateCall,
  } = useCallManager();

  return (
    <CallContext.Provider value={{ initiateCall, processing }}>
      {children}

      {/* Incoming Call Modal */}
      {incomingCall && !activeCall && (
        <IncomingCallModal
          visible={true}
          callerName={incomingCall.customerName}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Active Call Screen */}
      {activeCall && (
        <CallScreen
          visible={true}
          customerName={activeCall.customerName}
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
