import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { getActiveCall, type ActiveCallInfo } from '@/api/call.api';
import { colors, spacing, radii, fonts } from './theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function CallBalanceCard() {
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [expired, setExpired] = useState(false);   // true when time hits 0
  const [dismissed, setDismissed] = useState(false); // true after 2-min "ended" banner
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; }
  }, []);

  const loadActiveCall = useCallback(async () => {
    try {
      const data = await getActiveCall();
      if (data.activeCall) {
        setActiveCall(data.activeCall);
        setExpired(false);
        setDismissed(false);
        setRemaining(getRemainingSeconds(data.activeCall));
      } else {
        setActiveCall(null);
      }
    } catch {
      setActiveCall(null);
    }
  }, []);

  // Fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      loadActiveCall();
    }, [loadActiveCall])
  );

  // Live countdown timer
  useEffect(() => {
    cleanup();

    if (!activeCall || !activeCall.startedAt || expired) return;

    timerRef.current = setInterval(() => {
      const secs = getRemainingSeconds(activeCall);
      setRemaining(secs);

      if (secs <= 0) {
        // Time is up — switch to "expired" state
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setExpired(true);

        // Auto-dismiss the card after 2 minutes
        dismissTimerRef.current = setTimeout(() => {
          setDismissed(true);
        }, 2 * 60 * 1000); // 2 minutes
      }
    }, 1000);

    return cleanup;
  }, [activeCall, expired, cleanup]);

  // Don't render if no active call, or card has been dismissed
  if (!activeCall || !activeCall.allowedTime || dismissed) return null;

  const partnerName = activeCall.partner.fullName;
  const avatarUri = activeCall.partner.profilePhoto
    ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=1E40AF&color=fff&size=80`;

  const isRinging = activeCall.status === 'ringing';
  const isLow = !expired && remaining > 0 && remaining <= 60;

  // ── Expired state: show "Purchased call duration ended" for 2 min ──
  if (expired) {
    return (
      <View style={[styles.card, styles.cardExpired]}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
        <View style={styles.info}>
          <Text style={styles.partnerName} numberOfLines={1}>{partnerName}</Text>
          <Text style={styles.expiredText}>Purchased call duration ended</Text>
        </View>
        <View style={styles.expiredBadge}>
          <Ionicons name="time" size={14} color="#DC2626" />
          <Text style={styles.expiredBadgeText}>0:00</Text>
        </View>
      </View>
    );
  }

  // ── Active state: show countdown ──
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  cardExpired: {
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
  // Expired state
  expiredText: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: '#DC2626',
  },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  expiredBadgeText: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 14,
    color: '#DC2626',
  },
});
