import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioSession } from '@livekit/react-native';
import { Room, RoomEvent, Track } from 'livekit-client';
import { getChatSocket } from '@/services/chat.socket';
import { endCall as endCallApi } from '@/api/call.api';
import { colors, spacing } from '@/app/(tabs)/home/theme';

interface IncomingCallScreenProps {
  visible: boolean;
  callId: string;
  partnerName: string;
  livekitUrl: string;
  livekitToken: string;
  onEndCall: () => void;
}

type CallState = 'connecting' | 'connected' | 'ended';

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
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const newSpeakerState = !isSpeakerOn;
    AudioSession.configureAudio({
      android: {
        preferredOutputList: newSpeakerState
          ? ['speaker', 'earpiece']
          : ['earpiece', 'speaker'],
      },
      ios: {
        defaultOutput: newSpeakerState ? 'speaker' : 'earpiece',
      },
    });
    setIsSpeakerOn(newSpeakerState);
  };

  return (
    <>
      <View style={styles.partnerInfo}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={60} color={colors.white} />
        </View>
        <Text style={styles.partnerName}>{partnerName}</Text>
        <Text style={styles.callStatus}>{formatDuration(callDuration)}</Text>
        {/* Recording indicator */}
        <View style={styles.recordingBadge}>
          <Text style={styles.recordingDot}>🔴</Text>
          <Text style={styles.recordingText}>Recording</Text>
        </View>
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

// ─── Main IncomingCallScreen ──────────────────────────────────────────────────

export default function IncomingCallScreen({
  visible,
  callId,
  partnerName,
  livekitUrl,
  livekitToken,
  onEndCall,
}: IncomingCallScreenProps) {
  const [callState, setCallState] = useState<CallState>('connecting');
  const [room, setRoom] = useState<Room | null>(null);
  const hasStartedAudio = useRef(false);
  const roomRef = useRef<Room | null>(null);
  const hasStartedLiveKit = useRef(false);
  const onEndCallRef = useRef(onEndCall);
  onEndCallRef.current = onEndCall;

  // Start audio session
  useEffect(() => {
    if (visible && !hasStartedAudio.current) {
      hasStartedAudio.current = true;
      const initAudio = async () => {
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: ['earpiece', 'speaker'],
            audioTypeOptions: {
              manageAudioFocus: true,
              audioMode: 'inCommunication',
              audioFocusMode: 'gain',
              audioStreamType: 'voiceCall',
              audioAttributesUsageType: 'voiceCommunication',
              audioAttributesContentType: 'speech',
            },
          },
          ios: {
            defaultOutput: 'earpiece',
          },
        });
        await AudioSession.startAudioSession();
      };
      initAudio().catch(() => {});
    }
    return () => {
      if (hasStartedAudio.current) {
        AudioSession.stopAudioSession().catch(() => {});
        hasStartedAudio.current = false;
      }
    };
  }, [visible]);

  // Reset state when visible
  useEffect(() => {
    if (visible) {
      setCallState('connecting');
      setRoom(null);
      roomRef.current = null;
      hasStartedLiveKit.current = false;
    }
  }, [visible]);

  // Listen for call_ended socket event so if partner hangs up, call ends here too
  useEffect(() => {
    if (!visible || callState === 'ended') return;

    let mounted = true;

    const handleCallEnded = (data: any) => {
      if (!mounted) return;
      if (data?.callId === callId) {
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
        setTimeout(() => onEndCallRef.current(), 1500);
      }
    };

    const socket = getChatSocket();
    if (socket) {
      socket.on('call_ended', handleCallEnded);
    }

    return () => {
      mounted = false;
      const s = getChatSocket();
      if (s) {
        s.off('call_ended', handleCallEnded);
      }
    };
  }, [visible, callState, callId]);

  // Connect to LiveKit immediately (customer already accepted)
  useEffect(() => {
    if (!visible) return;
    if (hasStartedLiveKit.current) return;
    hasStartedLiveKit.current = true;

    let mounted = true;

    const startConnection = async () => {
      // Small delay to ensure AudioSession is initialized
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!mounted) return;

      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = lkRoom;

      const handleDisconnected = () => {
        if (mounted) {
          setCallState('ended');
          setTimeout(() => onEndCallRef.current(), 1500);
        }
      };

      const handleParticipantConnected = () => {
        if (mounted) {
          setCallState('connected');
        }
      };

      lkRoom.on(RoomEvent.Disconnected, handleDisconnected);
      lkRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

      // Re-apply audio config when remote audio track is subscribed (earpiece default)
      const handleTrackSubscribed = (
        track: any,
        _publication: any,
        _participant: any
      ) => {
        if (track.kind === Track.Kind.Audio) {
          AudioSession.configureAudio({
            android: {
              preferredOutputList: ['earpiece', 'speaker'],
              audioTypeOptions: {
                manageAudioFocus: true,
                audioMode: 'inCommunication',
                audioFocusMode: 'gain',
                audioStreamType: 'voiceCall',
                audioAttributesUsageType: 'voiceCommunication',
                audioAttributesContentType: 'speech',
              },
            },
            ios: {
              defaultOutput: 'earpiece',
            },
          });
        }
      };
      lkRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

      try {
        await lkRoom.connect(livekitUrl, livekitToken, { autoSubscribe: true });
        if (!mounted) {
          lkRoom.disconnect();
          return;
        }
        setRoom(lkRoom);

        // Enable mic immediately after connection
        try {
          await lkRoom.localParticipant.setMicrophoneEnabled(true);
        } catch {
          // Non-fatal
        }

        // If partner already connected
        if (lkRoom.remoteParticipants.size > 0) {
          setCallState('connected');
        }
      } catch {
        if (mounted) {
          setCallState('ended');
          setTimeout(() => onEndCallRef.current(), 1500);
        }
      }
    };

    startConnection();

    return () => {
      mounted = false;
      if (roomRef.current) {
        roomRef.current.off(RoomEvent.Disconnected);
        roomRef.current.off(RoomEvent.ParticipantConnected);
        roomRef.current.off(RoomEvent.TrackSubscribed);
      }
    };
  }, [visible, livekitUrl, livekitToken]);

  // Cleanup when hidden
  useEffect(() => {
    if (!visible && roomRef.current) {
      roomRef.current.disconnect().catch(() => {});
      roomRef.current = null;
      setRoom(null);
    }
  }, [visible]);

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

    // Call the backend to properly end the call
    if (callId) {
      endCallApi(callId).catch(() => {});
    }

    onEndCallRef.current();
  }, [callId]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleEndCall}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {callState === 'connecting' && (
          <View style={styles.connectingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.connectingText}>Connecting to {partnerName}...</Text>
          </View>
        )}

        {callState === 'connected' && room && (
          <CallControls room={room} onEndCall={handleEndCall} partnerName={partnerName} />
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
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recordingDot: {
    fontSize: 10,
  },
  recordingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
});
