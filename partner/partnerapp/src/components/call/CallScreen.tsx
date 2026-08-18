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

interface CallScreenProps {
  visible: boolean;
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
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
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
        <Text style={styles.callStatus}>{formatDuration(callDuration)}</Text>
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
      // Configure audio for voice communication and start session
      const initAudio = async () => {
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: ['speaker', 'earpiece'],
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
            defaultOutput: 'speaker',
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

      lkRoom.on(RoomEvent.Disconnected, handleDisconnected);
      lkRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

      // When a remote audio track is subscribed, re-apply audio configuration
      // to ensure Android routes audio to the correct output
      const handleTrackSubscribed = (
        track: any,
        _publication: any,
        _participant: any
      ) => {
        if (track.kind === Track.Kind.Audio) {
          AudioSession.configureAudio({
            android: {
              preferredOutputList: ['speaker', 'earpiece'],
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
              defaultOutput: 'speaker',
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

        // Enable mic only if the room is still connected
        setTimeout(async () => {
          if (!mounted) return;
          if (lkRoom.state !== 'connected') return;
          try {
            await lkRoom.localParticipant.setMicrophoneEnabled(true);
          } catch {
            // Non-fatal — room may have disconnected in the meantime
          }
        }, 500);

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
});
