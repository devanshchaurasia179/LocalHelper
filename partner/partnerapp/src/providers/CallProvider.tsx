import React from 'react';
import useCallManager from '@/hooks/useCallManager';
import IncomingCallModal from '@/components/call/IncomingCallModal';
import CallScreen from '@/components/call/CallScreen';
import Toast from 'react-native-toast-message';

interface CallProviderProps {
  children: React.ReactNode;
}

/**
 * CallProvider wraps the app and handles incoming calls globally.
 * It shows incoming call modals and active call screens on top of any screen.
 */
export function CallProvider({ children }: CallProviderProps) {
  const {
    incomingCall,
    activeCall,
    processing,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
  } = useCallManager();

  return (
    <>
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
    </>
  );
}
