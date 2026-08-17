import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LiveKitRoom,
  useRoom,
  AudioSession,
  useTracks,
  useParticipants,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import type { NearbyPartner } from '@/api/nearby.api';
import { colors, spacing, radii } from '@/app/(tabs)/home/theme';

const { width, height } = Dimensions.get('window');

interface CallScreenProps {
  visible: boolean;
  partner: NearbyPartner;
  livekitUrl: string;
  livekitToken: string;
  onEndCall: () => void;
}

function CallControls({ onEndCall, partnerName }: { onEndCall: () => void; partnerName: string }) {
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
      {/* Partner Info */}
      <View style={styles.partnerInfo}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={60} color={colors.white} />
        </View>
        <Text style={styles.partnerName}>{partnerName}</Text>
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
            color={isMuted ? colors.white : colors.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={onEndCall}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={32} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
          onPress={toggleSpeaker}
          activeOpacity={0.8}
        >
          <Ionicons
            name="volume-high"
            size={28}
            color={isSpeakerOn ? colors.white : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function CallScreen({
  visible,
  partner,
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
    // Mark as disconnected immediately to prevent rendering children
    // that rely on the room context
    setIsDisconnected(true);

    if (hasStartedAudio.current) {
      AudioSession.stopAudioSession().catch(console.error);
      hasStartedAudio.current = false;
    }
    onEndCall();
  };

  const getPartnerName = () => {
    return (partner as any).name || (partner as any).businessName || 'Partner';
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
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.connectingText}>Connecting to {getPartnerName()}...</Text>
            </View>
          ) : (
            <CallControls onEndCall={handleDisconnect} partnerName={getPartnerName()} />
          )}
        </LiveKitRoom>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  connectingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  connectingText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  partnerInfo: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: 60,
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  partnerName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  callStatus: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingBottom: 40,
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlBtnActive: {
    backgroundColor: colors.primary,
  },
  endCallBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
  },
});
