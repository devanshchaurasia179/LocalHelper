import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LiveKitRoom,
  useRoom,
  AudioSession,
} from '@livekit/react-native';

interface CallScreenProps {
  visible: boolean;
  customerName: string;
  livekitUrl: string;
  livekitToken: string;
  onEndCall: () => void;
}

function CallControls({ onEndCall, customerName }: { onEndCall: () => void; customerName: string }) {
  const room = useRoom();
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const toggleMute = async () => {
    if (room) {
      await room.localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    AudioSession.configureAudio({
      android: {
        preferredOutputList: isSpeakerOn
          ? ['earpiece', 'speaker']
          : ['speaker', 'earpiece'],
      },
      ios: {
        defaultOutput: isSpeakerOn ? 'earpiece' : 'speaker',
      },
    });
    setIsSpeakerOn(!isSpeakerOn);
  };

  return (
    <>
      {/* Customer Info */}
      <View style={styles.customerInfo}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={60} color="#fff" />
        </View>
        <Text style={styles.customerName}>{customerName}</Text>
        <Text style={styles.callStatus}>On Call</Text>
      </View>

      {/* Call Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={toggleMute}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={28}
            color={isMuted ? '#fff' : '#111827'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={onEndCall}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={32} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
          onPress={toggleSpeaker}
          activeOpacity={0.8}
        >
          <Ionicons
            name="volume-high"
            size={28}
            color={isSpeakerOn ? '#fff' : '#111827'}
          />
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function CallScreen({
  visible,
  customerName,
  livekitUrl,
  livekitToken,
  onEndCall,
}: CallScreenProps) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const hasStartedAudio = useRef(false);

  useEffect(() => {
    if (visible && !hasStartedAudio.current) {
      AudioSession.startAudioSession().catch(console.error);
      hasStartedAudio.current = true;
    }

    return () => {
      if (hasStartedAudio.current) {
        AudioSession.stopAudioSession().catch(console.error);
        hasStartedAudio.current = false;
      }
    };
  }, [visible]);

  // Reset state when the call screen becomes visible again
  useEffect(() => {
    if (visible) {
      setIsConnecting(true);
      setIsDisconnected(false);
    }
  }, [visible]);

  const handleDisconnect = () => {
    setIsDisconnected(true);

    if (hasStartedAudio.current) {
      AudioSession.stopAudioSession().catch(console.error);
      hasStartedAudio.current = false;
    }
    onEndCall();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleDisconnect}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={livekitToken}
          connect={visible && !isDisconnected}
          options={{
            adaptiveStream: true,
            dynacast: true,
          }}
          audio={true}
          video={false}
          onConnected={() => setIsConnecting(false)}
          onDisconnected={handleDisconnect}
        >
          {isDisconnected ? (
            <View style={styles.connectingContainer}>
              <Text style={styles.connectingText}>Call ended</Text>
            </View>
          ) : isConnecting ? (
            <View style={styles.connectingContainer}>
              <ActivityIndicator size="large" color="#16493C" />
              <Text style={styles.connectingText}>Connecting to {customerName}...</Text>
            </View>
          ) : (
            <CallControls onEndCall={handleDisconnect} customerName={customerName} />
          )}
        </LiveKitRoom>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  connectingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  connectingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  customerInfo: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 60,
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#16493C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  customerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  callStatus: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingBottom: 40,
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlBtnActive: {
    backgroundColor: '#16493C',
  },
  endCallBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
  },
});
