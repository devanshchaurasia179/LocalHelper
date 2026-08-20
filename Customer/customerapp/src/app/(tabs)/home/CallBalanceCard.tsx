import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { getActiveCall, getCallBalance, type ActiveCallInfo } from '@/api/call.api';
import { getChatSocket } from '@/services/chat.socket';
import { colors, spacing, radii, fonts } from './theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0:00';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatMinutes(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 min';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

function getRemainingSeconds(call: ActiveCallInfo): number {
  if (!call.allowedTime) return 0;
  if (!call.startedAt) return call.allowedTime;
  const elapsed = Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000);
  return Math.max(0, call.allowedTime - elapsed);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CallBalanceCardProps {
  /** Called when user taps the call button — passes partnerId and partner info */
  onCallPartner?: (partnerId: string, partnerInfo: { fullName: string; profilePhoto: string | null }) => void;
}

export default function CallBalanceCard({ onCallPartner }: CallBalanceCardProps) {
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const [callBalanceSeconds, setCallBalanceSeconds] = useState<number>(0);
  const [balancePartner, setBalancePartner] = useState<{
    _id: string;
    fullName: string;
    profilePhoto: string | null;
  } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [activeData, balanceData] = await Promise.all([
        getActiveCall(),
        getCallBalance(),
      ]);

      const call = activeData.activeCall;

      // Only treat as active if it's actually in a live state with allowedTime
      if (call && call.allowedTime && call.allowedTime > 0) {
        const secs = getRemainingSeconds(call);
        if (secs > 0) {
          // Call is still live with time remaining
          setActiveCall(call);
          setRemaining(secs);
        } else {
          // allowedTime is fully consumed — don't show as active
          setActiveCall(null);
        }
      } else {
        setActiveCall(null);
      }

      setCallBalanceSeconds(balanceData.callBalance ?? 0);
      setBalancePartner(balanceData.partner ?? null);
    } catch {
      setActiveCall(null);
      setCallBalanceSeconds(0);
      setBalancePartner(null);
    }
  }, []);

  // Fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Listen for call_ended / call_time_exhausted to refresh immediately
  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) return;

    const handleCallEnded = () => {
      // Clear active call immediately and refresh balance
      setActiveCall(null);
      cleanup();
      getCallBalance()
        .then((data) => {
          setCallBalanceSeconds(data.callBalance ?? 0);
          setBalancePartner(data.partner ?? null);
        })
        .catch(() => {
          setCallBalanceSeconds(0);
          setBalancePartner(null);
        });
    };

    socket.on('call_ended', handleCallEnded);
    socket.on('call_time_exhausted', handleCallEnded);

    return () => {
      socket.off('call_ended', handleCallEnded);
      socket.off('call_time_exhausted', handleCallEnded);
    };
  }, [cleanup]);

  // Live countdown timer for active call
  useEffect(() => {
    cleanup();

    if (!activeCall || !activeCall.startedAt) return;

    timerRef.current = setInterval(() => {
      const secs = getRemainingSeconds(activeCall);
      setRemaining(secs);

      if (secs <= 0) {
        cleanup();
        // Time exhausted — clear the active call so it shows balance card instead
        setActiveCall(null);
        // Refresh balance from server
        getCallBalance()
          .then((data) => {
            setCallBalanceSeconds(data.callBalance ?? 0);
            setBalancePartner(data.partner ?? null);
          })
          .catch(() => {});
      }
    }, 1000);

    return cleanup;
  }, [activeCall, cleanup]);

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

  // ── No active call — show call balance if > 0 ──
  if (callBalanceSeconds <= 0) return null;

  const partnerName = balancePartner?.fullName ?? 'Partner';
  const avatarUri = balancePartner?.profilePhoto
    ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=1E40AF&color=fff&size=80`;

  return (
    <View style={styles.balanceCard}>
      <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
      <View style={styles.info}>
        <Text style={styles.balanceTitle} numberOfLines={1}>{partnerName}</Text>
        <Text style={styles.balanceSubtitle}>
          {formatMinutes(callBalanceSeconds)} available
        </Text>
      </View>
      <TouchableOpacity
        style={styles.callBtn}
        onPress={() => balancePartner && onCallPartner?.(balancePartner._id, {
          fullName: balancePartner.fullName,
          profilePhoto: balancePartner.profilePhoto,
        })}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Call ${partnerName}`}
      >
        <Ionicons name="call" size={16} color="#fff" />
        <Text style={styles.callBtnText}>Call</Text>
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
  // ── Call balance (no active call) ──
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm + 2,
    backgroundColor: '#F0F9FF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: spacing.sm,
  },
  balanceTitle: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  balanceSubtitle: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: '#64748B',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E40AF',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  callBtnText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 13,
    color: '#fff',
  },
});
