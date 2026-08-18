import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
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
  callId: string;
  livekitUrl: string;
  livekitToken: string;
  onEndCall: () => void;
}

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
  room: Room;
  onEndCall: () => void;
  partnerName: string;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer immediately — we only render this component when peer joined
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleMute = async () => {
    await room.localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
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
        <Text style={styles.callStatus}>{formatDuration(callDuration)}</Text>
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
  callId,
  livekitUrl,
  livekitToken,
  onEndCall,
}: CallScreenProps) {
  const [callState, setCallState] = useState<CallState>('dialling');
  const [room, setRoom] = useState<Room | null>(null);
  const hasStartedAudio = useRef(false);
  const roomRef = useRef<Room | null>(null);
  // Store the LiveKit credentials (from call_accepted event or original response)
  const livekitRef = useRef<{ url: string; token: string }>({ url: livekitUrl, token: livekitToken });

  // Start audio session when visible
  useEffect(() => {
    if (visible && !hasStartedAudio.current) {
      AudioSession.startAudioSession().catch(() => {});
      hasStartedAudio.current = true;
    }
    return () => {
      if (hasStartedAudio.current) {
        AudioSession.stopAudioSession().catch(() => {});
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
      livekitRef.current = { url: livekitUrl, token: livekitToken };
    }
  }, [visible]);

  // Phase 1: While dialling, listen for call_accepted or call_rejected via Socket.IO.
  // Do NOT connect to LiveKit yet — wait until partner accepts.
  useEffect(() => {
    if (!visible || callState !== 'dialling') return;

    let mounted = true;

    const handleCallAccepted = (data: any) => {
      if (!mounted) return;
      // If the event includes fresh LiveKit credentials, use those
      if (data?.livekit?.url && data?.livekit?.token) {
        livekitRef.current = { url: data.livekit.url, token: data.livekit.token };
      }
      setCallState('connecting');
    };

    const handleCallRejected = () => {
      if (!mounted) return;
      setCallState('ended');
      setTimeout(() => onEndCall(), 1500);
    };

    const handleCallEnded = (data: any) => {
      if (!mounted) return;
      if (data?.callId === callId) {
        setCallState('ended');
        setTimeout(() => onEndCall(), 1500);
      }
    };

    // Set a 60 second timeout — if partner doesn't answer, end the call
    const timeout = setTimeout(() => {
      if (!mounted) return;
      setCallState('ended');
      setTimeout(() => onEndCall(), 1500);
    }, 60000);

    connectChatSocket()
      .then((socket) => {
        if (!mounted) return;
        socket.on('call_accepted', handleCallAccepted);
        socket.on('call_rejected', handleCallRejected);
        socket.on('call_ended', handleCallEnded);
      })
      .catch(() => {});

    return () => {
      mounted = false;
      clearTimeout(timeout);
      const socket = getChatSocket();
      if (socket) {
        socket.off('call_accepted', handleCallAccepted);
        socket.off('call_rejected', handleCallRejected);
        socket.off('call_ended', handleCallEnded);
      }
    };
  }, [visible, callState, callId, onEndCall]);

  // Phase 2: Partner accepted — now connect to LiveKit
  useEffect(() => {
    if (!visible || callState !== 'connecting') return;

    let mounted = true;
    const { url, token } = livekitRef.current;

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

    const handleParticipantConnected = () => {
      if (mounted) {
        setCallState('connected');
      }
    };

    lkRoom.on(RoomEvent.Disconnected, handleDisconnected);
    lkRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    lkRoom
      .connect(url, token, { autoSubscribe: true })
      .then(async () => {
        if (!mounted) {
          lkRoom.disconnect();
          return;
        }
        setRoom(lkRoom);
        setCallState('connected');

        // Enable mic after signal connection is confirmed
        setTimeout(async () => {
          if (!mounted) return;
          try {
            await lkRoom.localParticipant.setMicrophoneEnabled(true);
          } catch {
            // Non-fatal
          }
        }, 500);
      })
      .catch(() => {
        if (mounted) {
          setCallState('ended');
          setTimeout(() => onEndCall(), 1500);
        }
      });

    return () => {
      mounted = false;
      lkRoom.off(RoomEvent.Disconnected, handleDisconnected);
      lkRoom.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      lkRoom.disconnect().catch(() => {});
      roomRef.current = null;
    };
  }, [visible, callState, onEndCall]);

  const handleEndCall = useCallback(() => {
    setCallState('ended');

    if (roomRef.current) {
      roomRef.current.disconnect().catch(() => {});
      roomRef.current = null;
      setRoom(null);
    }

    if (hasStartedAudio.current) {
      AudioSession.stopAudioSession().catch(() => {});
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
        {(callState === 'dialling' || callState === 'connecting') && (
          <DiallingView partnerName={getPartnerName()} onCancel={handleEndCall} />
        )}

        {callState === 'connected' && room && (
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
