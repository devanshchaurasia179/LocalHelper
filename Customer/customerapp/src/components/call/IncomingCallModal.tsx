import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/app/(tabs)/home/theme';

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({
  visible,
  callerName,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Vibrate when call comes in
      Vibration.vibrate([0, 400, 200, 400]);

      // Start pulse animation
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();

      return () => {
        animation.stop();
        Vibration.cancel();
      };
    }
  }, [visible, pulseAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Caller Icon */}
          <Animated.View
            style={[
              styles.avatarCircle,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Ionicons name="person" size={60} color="#fff" />
          </Animated.View>

          {/* Caller Info */}
          <Text style={styles.title}>Incoming Call</Text>
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.subtitle}>wants to connect with you</Text>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {/* Reject */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={onReject}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={32} color="#fff" />
              <Text style={styles.actionLabel}>Decline</Text>
            </TouchableOpacity>

            {/* Accept */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={onAccept}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={32} color="#fff" />
              <Text style={styles.actionLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  callerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
  },
  actionBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  actionLabel: {
    position: 'absolute',
    bottom: -24,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
