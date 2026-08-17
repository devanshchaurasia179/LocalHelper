import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioSession } from '@livekit/react-native';
import { Room, RoomEvent } from 'livekit-client';
import { connectChatSocket, getChatSocket } from '@/services/chat.socket';
import type { NearbyPartner } from '@/api/nearby.api';
import { colors, spacing } from '@/app/(tabs)/home/theme';

interface CallScreenProps {
  visible: boolean;
  partner: NearbyPartner;
  livekitUrl: string;
  livekitToken: string;
  onEndCall: () => void;
}

// ─── Call States ──────────────────────────────────────────────────────────────

type CallState = 'dialling' | 'connecting' | 'connected' | 'ended';

// ─── Dialling UI (pulsing ring animation) ─────────────────────────────────────

function DiallingView({ partnerName, onCancel }: { partnerName: string; onCancel: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <>
      <View style={styles.partnerInfo}>
        <Animated.View style={[styles.avatarCircle, { transform: [{ scale: pulse }] }]}>
          <Ionicons name="person" size={60} color={colors.white} />
        </Animated.View>
        <Text style={styles.partnerName}>{partnerName}</Text>
        <Text style={styles.callStatus}>Dialling...</Text>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={onCancel}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={32} color={colors.white} />
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Connected Call Controls ──────────────────────────────────────────────────

function CallControls({
  room,
  onEndCall,
  partnerName,
}: {
  room: Room | null;
  onEndCall: () => void;
  partnerName: string;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [peerJoined, setPeerJoined] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect when the remote participant (partner) is in the room
  useEffect(() => {
    if (!room) return;

    if (room.remoteParticipants.size > 0) {
      setPeerJoined(true);
    }

    const handleParticipantConnected = () => {
      setPeerJoined(true);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [room]);

  // Timer starts only when peer has joined
  useEffect(() => {
    if (!peerJoined) return;
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [peerJoined]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
      <View style={styles.partnerInfo}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={60} color={colors.white} />
        </View>
        <Text style={styles.partnerName}>{partnerName}</Text>
        <Text style={styles.callStatus}>
          {peerJoined ? formatDuration(callDuration) : 'Waiting for partner...'}
        </Text>
      </View>

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

// ─── Main CallScreen ──────────────────────────────────────────────────────────

export default function CallScreen({
  visible,
  partner,
  livekitUrl,
  livekitToken,
  onEndCall,
}: CallScreenProps) {
  const [callState, setCallState] = useState<CallState>('dialling');
  const [room, setRoom] = useState<Room | null>(null);
  const hasStartedAudio = useRef(false);
  const roomRef = useRef<Room | null>(null);

  // Start audio session when visible
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

  // Reset state when call screen becomes visible
  useEffect(() => {
    if (visible) {
      setCallState('dialling');
      setRoom(null);
      roomRef.current = null;
    }
  }, [visible]);

  // Listen for call_accepted / call_rejected via socket
  // When partner accepts → connect to LiveKit
  useEffect(() => {
    if (!visible || callState !== 'dialling') return;

    let mounted = true;

    const handleCallAccepted = (data: { callId: string; roomName: string }) => {
      console.log('═══════════════════════════════════════════════════════');
      console.log('[CallScreen] CALL ACCEPTED EVENT RECEIVED');
      console.log('[CallScreen] Data:', JSON.stringify(data, null, 2));
      console.log('═══════════════════════════════════════════════════════');
      if (!mounted) return;
      // Partner accepted — now we connect to LiveKit
      setCallState('connecting');
    };

    const handleCallRejected = (data: { callId: string }) => {
      console.log('[CallScreen] Partner rejected the call:', data);
      if (!mounted) return;
      setCallState('ended');
      // Small delay so user sees "ended" state before modal closes
      setTimeout(() => onEndCall(), 1500);
    };

    const setup = async () => {
      try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('[CallScreen] Setting up call response listeners...');
        const socket = await connectChatSocket();
        if (!mounted) return;
        
        console.log('[CallScreen] Socket instance:', {
          id: socket.id,
          connected: socket.connected,
          disconnected: socket.disconnected,
        });
        
        // Log all socket events for debugging
        socket.onAny((eventName, ...args) => {
          console.log(`[CallScreen] Socket event "${eventName}":`, args);
        });
        
        socket.on('call_accepted', handleCallAccepted);
        socket.on('call_rejected', handleCallRejected);
        
        console.log('[CallScreen] Listeners attached for call_accepted and call_rejected');
        console.log('[CallScreen] Socket rooms:', Array.from(socket.rooms || []));
        console.log('═══════════════════════════════════════════════════════');
      } catch (err) {
        console.warn('[CallScreen] Socket setup error:', err);
      }
    };

    setup();

    return () => {
      mounted = false;
      const socket = getChatSocket();
      if (socket) {
        socket.off('call_accepted', handleCallAccepted);
        socket.off('call_rejected', handleCallRejected);
        socket.offAny(); // Remove the catch-all listener
      }
    };
  }, [visible, callState, onEndCall]);

  // Connect to LiveKit ONLY when callState becomes 'connecting'
  useEffect(() => {
    if (callState !== 'connecting') return;

    let mounted = true;
    const lkRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = lkRoom;

    const handleDisconnected = () => {
      if (mounted) {
        setCallState('ended');
        setTimeout(() => onEndCall(), 1500);
      }
    };

    lkRoom.on(RoomEvent.Disconnected, handleDisconnected);

    lkRoom
      .connect(livekitUrl, livekitToken, { autoSubscribe: true })
      .then(async () => {
        if (!mounted) {
          lkRoom.disconnect();
          return;
        }
        await lkRoom.localParticipant.setMicrophoneEnabled(true);
        setRoom(lkRoom);
        setCallState('connected');
      })
      .catch((err) => {
        console.error('[CallScreen] LiveKit connect error:', err);
        if (mounted) {
          setCallState('ended');
          setTimeout(() => onEndCall(), 1500);
        }
      });

    return () => {
      mounted = false;
      lkRoom.off(RoomEvent.Disconnected, handleDisconnected);
      lkRoom.disconnect().catch(() => {});
      roomRef.current = null;
    };
  }, [callState, livekitUrl, livekitToken, onEndCall]);

  const handleEndCall = useCallback(() => {
    setCallState('ended');

    if (roomRef.current) {
      roomRef.current.disconnect().catch(() => {});
      roomRef.current = null;
      setRoom(null);
    }

    if (hasStartedAudio.current) {
      AudioSession.stopAudioSession().catch(console.error);
      hasStartedAudio.current = false;
    }

    onEndCall();
  }, [onEndCall]);

  const getPartnerName = () => {
    return (partner as any).fullName || (partner as any).name || (partner as any).businessName || 'Partner';
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleEndCall}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {callState === 'dialling' && (
          <DiallingView partnerName={getPartnerName()} onCancel={handleEndCall} />
        )}

        {callState === 'connecting' && (
          <View style={styles.connectingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}

        {callState === 'connected' && (
          <CallControls room={room} onEndCall={handleEndCall} partnerName={getPartnerName()} />
        )}

        {callState === 'ended' && (
          <View style={styles.connectingContainer}>
            <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
            <Text style={styles.connectingText}>Call ended</Text>
          </View>
        )}
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
