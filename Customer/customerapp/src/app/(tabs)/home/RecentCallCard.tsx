import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { getCustomerCallHistory, getActiveCall, type CallRecord, type ActiveCallInfo } from '@/api/call.api';
import { getChatSocket } from '@/services/chat.socket';
import { colors, spacing, radii, fonts } from './theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0:00';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getRemainingSeconds(call: ActiveCallInfo): number {
  if (!call.allowedTime) return 0;
  if (!call.startedAt) return call.allowedTime;
  const elapsed = Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000);
  return Math.max(0, call.allowedTime - elapsed);
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/** Returns true if the call ended more than 5 minutes ago */
function isExpired(call: CallRecord): boolean {
  if (!call.endedAt) return false;
  const elapsed = Date.now() - new Date(call.endedAt).getTime();
  return elapsed > 5 * 60 * 1000; // 5 minutes
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RecentCallCardProps {
  onCallPartner?: (partnerId: string, partnerInfo: { fullName: string; profilePhoto: string | null }) => void;
}

export default function RecentCallCard({ onCallPartner }: RecentCallCardProps) {
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [recentCall, setRecentCall] = useState<CallRecord | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const cleanupExpiry = useCallback(() => {
    if (expiryRef.current) { clearTimeout(expiryRef.current); expiryRef.current = null; }
  }, []);

  const loadData = useCallback(async () => {
    try {
      // Check for active call first
      const activeData = await getActiveCall();
      const call = activeData.activeCall;

      if (call && call.allowedTime && call.allowedTime > 0) {
        const secs = getRemainingSeconds(call);
        if (secs > 0) {
          setActiveCall(call);
          setRemaining(secs);
          setVisible(true);
          return;
        }
      }
      setActiveCall(null);

      // No active call — fetch recent call history
      const historyData = await getCustomerCallHistory(1, 1);
      const calls = historyData.calls;

      if (calls.length > 0) {
        const latest = calls[0];
        // Only show completed/ended calls that haven't expired (5 min window)
        if (
          (latest.status === 'completed' || latest.status === 'missed' || latest.status === 'rejected' || latest.status === 'cancelled') &&
          !isExpired(latest)
        ) {
          setRecentCall(latest);
          setVisible(true);

          // Set a timer to hide the card when 5 min expires
          cleanupExpiry();
          if (latest.endedAt) {
            const remainingMs = 5 * 60 * 1000 - (Date.now() - new Date(latest.endedAt).getTime());
            if (remainingMs > 0) {
              expiryRef.current = setTimeout(() => {
                setVisible(false);
                setRecentCall(null);
              }, remainingMs);
            }
          }
        } else {
          setRecentCall(null);
          setVisible(false);
        }
      } else {
        setRecentCall(null);
        setVisible(false);
      }
    } catch {
      setActiveCall(null);
      setRecentCall(null);
      setVisible(false);
    }
  }, [cleanupExpiry]);

  // Fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        cleanupExpiry();
      };
    }, [loadData, cleanupExpiry])
  );

  // Listen for call_ended to refresh immediately
  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) return;

    const handleCallEnded = () => {
      setActiveCall(null);
      cleanup();
      // Refresh to show the recent call
      loadData();
    };

    socket.on('call_ended', handleCallEnded);
    socket.on('call_time_exhausted', handleCallEnded);

    return () => {
      socket.off('call_ended', handleCallEnded);
      socket.off('call_time_exhausted', handleCallEnded);
    };
  }, [cleanup, loadData]);

  // Live countdown timer for active call
  useEffect(() => {
    cleanup();

    if (!activeCall || !activeCall.startedAt) return;

    timerRef.current = setInterval(() => {
      const secs = getRemainingSeconds(activeCall);
      setRemaining(secs);

      if (secs <= 0) {
        cleanup();
        setActiveCall(null);
        // Refresh to show recent call
        loadData();
      }
    }, 1000);

    return cleanup;
  }, [activeCall, cleanup, loadData]);

  if (!visible) return null;

  // ── Active call: show live countdown ──
  if (activeCall && activeCall.allowedTime && remaining > 0) {
    const partnerName = activeCall.partner.fullName;
    const avatarUri = activeCall.partner.profilePhoto
      ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=1E40AF&color=fff&size=80`;

    const isRinging = activeCall.status === 'ringing';
    const isLow = remaining <= 60;

    return (
      <View style={[styles.card, isLow && styles.cardLow]}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />

        <View style={styles.info}>
          <Text style={styles.partnerName} numberOfLines={1}>{partnerName}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, isRinging ? styles.dotRinging : styles.dotActive]} />
            <Text style={styles.statusText}>
              {isRinging ? 'Ringing…' : 'On call'}
            </Text>
          </View>
        </View>

        <View style={[styles.timeBox, isLow && styles.timeBoxLow]}>
          <Ionicons name="time-outline" size={14} color={isLow ? '#DC2626' : '#1E40AF'} />
          <Text style={[styles.timeText, isLow && styles.timeTextLow]}>
            {formatTime(remaining)}
          </Text>
        </View>
      </View>
    );
  }

  // ── Recent call card ──
  if (!recentCall) return null;

  const partnerName = recentCall.partner?.fullName ?? 'Partner';
  const avatarUri = recentCall.partner?.profilePhoto
    ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=1E40AF&color=fff&size=80`;

  const statusIcon = recentCall.status === 'completed' ? 'call-outline' :
    recentCall.status === 'missed' ? 'call-outline' : 'close-circle-outline';
  const statusColor = recentCall.status === 'completed' ? '#10B981' :
    recentCall.status === 'missed' ? '#F59E0B' : '#94A3B8';
  const statusLabel = recentCall.status === 'completed'
    ? `${formatDuration(recentCall.duration)} call`
    : recentCall.status === 'missed' ? 'Missed call'
    : recentCall.status === 'rejected' ? 'Declined'
    : 'Cancelled';

  return (
    <View style={styles.recentCard}>
      <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
      <View style={styles.info}>
        <Text style={styles.partnerName} numberOfLines={1}>{partnerName}</Text>
        <View style={styles.statusRow}>
          <Ionicons name={statusIcon as any} size={12} color={statusColor} />
          <Text style={styles.recentStatus}>{statusLabel}</Text>
          <Text style={styles.recentTime}>• {timeAgo(recentCall.endedAt ?? recentCall.updatedAt)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.callBtn}
        onPress={() => recentCall.partner && onCallPartner?.(recentCall.partner._id, {
          fullName: recentCall.partner.fullName,
          profilePhoto: recentCall.partner.profilePhoto ?? null,
        })}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Call back ${partnerName}`}
      >
        <Ionicons name="call" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Active call card ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm + 2,
    backgroundColor: '#EFF6FF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: spacing.sm,
  },
  cardLow: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  partnerName: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotRinging: {
    backgroundColor: '#F59E0B',
  },
  dotActive: {
    backgroundColor: '#10B981',
  },
  statusText: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: '#64748B',
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DBEAFE',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeBoxLow: {
    backgroundColor: '#FEE2E2',
  },
  timeText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: '#1E40AF',
  },
  timeTextLow: {
    color: '#DC2626',
  },
  // ── Recent call card ──
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm + 2,
    backgroundColor: '#F8FAFC',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: spacing.sm,
  },
  recentStatus: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: '#64748B',
  },
  recentTime: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: '#94A3B8',
  },
  callBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    backgroundColor: '#1E40AF',
    borderRadius: 18,
  },
});
