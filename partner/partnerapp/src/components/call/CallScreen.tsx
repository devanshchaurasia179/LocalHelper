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

interface CallScreenProps {
  visible: boolean;
  callId: string;
  customerName: string;
  livekitUrl: string;
  livekitToken: string;
  onEndCall: () => void;
}

type CallState = 'connecting' | 'connected' | 'ended';

// ─── Connected Call Controls ──────────────────────────────────────────────────

function CallControls({
  room,
  onEndCall,
  customerName,
}: {
  room: Room;
  onEndCall: () => void;
  customerName: string;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer immediately — we only render this when peer is in the room
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
      {/* Customer Info */}
      <View style={styles.customerInfo}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={60} color="#fff" />
        </View>
        <Text style={styles.customerName}>{customerName}</Text>
        <Text style={styles.callStatus}>{formatDuration(callDuration)}</Text>
        {/* Recording indicator */}
        <View style={styles.recordingBadge}>
          <Text style={styles.recordingDot}>🔴</Text>
          <Text style={styles.recordingText}>Recording</Text>
        </View>
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

// ─── Main CallScreen ──────────────────────────────────────────────────────────

export default function CallScreen({
  visible,
  callId,
  customerName,
  livekitUrl,
  livekitToken,
  onEndCall,
}: CallScreenProps) {
  const [callState, setCallState] = useState<CallState>('connecting');
  const [room, setRoom] = useState<Room | null>(null);
  const hasStartedAudio = useRef(false);
  const roomRef = useRef<Room | null>(null);
  const hasStartedLiveKit = useRef(false);
  const onEndCallRef = useRef(onEndCall);
  onEndCallRef.current = onEndCall;

  useEffect(() => {
    if (visible && !hasStartedAudio.current) {
      hasStartedAudio.current = true;
      // Configure audio for voice communication — default to earpiece (not speaker)
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

  // Listen for call_ended socket event so if customer hangs up, call ends here too
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

  // Connect to LiveKit immediately (partner already accepted).
  // Timer starts when the remote participant (customer) joins via ParticipantConnected.
  useEffect(() => {
    if (!visible) return;
    if (hasStartedLiveKit.current) return;
    hasStartedLiveKit.current = true;

    let mounted = true;

    const startConnection = async () => {
      // Small delay to ensure AudioSession is initialized before connecting
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

      // When the customer joins the room → call is live, start timer
      const handleParticipantConnected = () => {
        if (mounted) {
          setCallState('connected');
        }
      };

      // When the customer leaves the room (hangs up) → end the call
      const handleParticipantDisconnected = () => {
        if (mounted && callState !== 'ended') {
          setCallState('ended');
          if (roomRef.current) {
            roomRef.current.disconnect().catch(() => {});
          }
          setTimeout(() => onEndCallRef.current(), 1500);
        }
      };

      lkRoom.on(RoomEvent.Disconnected, handleDisconnected);
      lkRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
      lkRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

      // When a remote audio track is subscribed, re-apply audio configuration
      // to ensure Android routes audio to the correct output (earpiece default)
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
          // Non-fatal — room may have disconnected in the meantime
        }

        // If customer already connected before we finished setup
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
        roomRef.current.off(RoomEvent.ParticipantDisconnected);
        roomRef.current.off(RoomEvent.TrackSubscribed);
      }
    };
  }, [visible, livekitUrl, livekitToken]); // stable deps only — runs once per call session

  // Cleanup: disconnect room when the call screen is hidden
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

    onEndCallRef.current();
  }, []);

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
            <ActivityIndicator size="large" color="#16493C" />
            <Text style={styles.connectingText}>Connecting to {customerName}...</Text>
          </View>
        )}

        {callState === 'connected' && room && (
          <CallControls room={room} onEndCall={handleEndCall} customerName={customerName} />
        )}

        {callState === 'ended' && (
          <View style={styles.connectingContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#16493C" />
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
