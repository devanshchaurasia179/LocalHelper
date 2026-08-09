import { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing, radii, fonts } from '../home/theme';
import { useBookings } from '@/hooks/useBookings';
import BookingCard from './BookingCard';
import BookingDetail from './BookingDetail';
import ReviewModal from './ReviewModal';
import BottomNav from '../home/BottomNav';
import type { Booking, StatusFilter } from './bookings.types';
import type { NavRoute } from '../home/types';
import { ROUTES } from '@/constants/routes';

// ─── Filter config ────────────────────────────────────────────────────────────

const FILTER_TABS: { key: StatusFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all',         label: 'All Bookings', icon: 'list-outline'             },
  { key: 'pending',     label: 'Pending',      icon: 'time-outline'             },
  { key: 'accepted',    label: 'Accepted',     icon: 'checkmark-circle-outline' },
  { key: 'in_progress', label: 'In Progress',  icon: 'construct-outline'        },
  { key: 'completed',   label: 'Completed',    icon: 'checkmark-done-outline'   },
  { key: 'cancelled',   label: 'Cancelled',    icon: 'close-circle-outline'     },
];

const FILTER_COLORS: Record<StatusFilter, { fg: string; bg: string; accent: string }> = {
  all:         { fg: colors.primary, bg: '#ECFDF5', accent: colors.primary },
  pending:     { fg: '#92400E',      bg: '#FFFBEB', accent: '#F59E0B'      },
  accepted:    { fg: '#1E40AF',      bg: '#EFF6FF', accent: '#3B82F6'      },
  in_progress: { fg: '#5B21B6',      bg: '#F5F3FF', accent: '#8B5CF6'      },
  completed:   { fg: '#065F46',      bg: '#ECFDF5', accent: '#10B981'      },
  cancelled:   { fg: '#991B1B',      bg: '#FFF1F2', accent: '#EF4444'      },
};

// ─── Filter Dropdown ──────────────────────────────────────────────────────────

interface FilterDropdownProps {
  visible: boolean;
  activeFilter: StatusFilter;
  anchorY: number;
  onSelect: (key: StatusFilter) => void;
  onClose: () => void;
}

function FilterDropdown({ visible, activeFilter, anchorY, onSelect, onClose }: FilterDropdownProps) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1,    duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 28, bounciness: 4 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0,    duration: 130, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 130, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[ddStyles.panel, { top: anchorY + 6, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {FILTER_TABS.map((tab, idx) => {
          const isActive = tab.key === activeFilter;
          const clr = FILTER_COLORS[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[ddStyles.item, idx < FILTER_TABS.length - 1 && ddStyles.itemBorder, isActive && { backgroundColor: clr.bg }]}
              onPress={() => { onSelect(tab.key); onClose(); }}
              activeOpacity={0.7}
            >
              <View style={[ddStyles.iconWrap, { backgroundColor: isActive ? clr.bg : colors.surface }]}>
                <Ionicons name={tab.icon} size={15} color={isActive ? clr.accent : colors.textSecondary} />
              </View>
              <Text style={[ddStyles.itemLabel, isActive && { color: clr.fg, fontFamily: fonts.jakartaSemiBold }]}>
                {tab.label}
              </Text>
              {isActive && <Ionicons name="checkmark" size={15} color={clr.accent} />}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

const ddStyles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: spacing.lg,
    width: 220,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: '#EBEBF0',
    overflow: 'hidden',
  },
  item:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 3 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F3F8' },
  iconWrap:   { width: 30, height: 30, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  itemLabel:  { flex: 1, fontFamily: fonts.jakartaMedium, fontSize: 13, color: colors.textSecondary },
});

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.accentBar} />
      <View style={skeletonStyles.inner}>
        <View style={skeletonStyles.topRow}>
          <Animated.View style={[skeletonStyles.avatar, { opacity }]} />
          <View style={skeletonStyles.lines}>
            <Animated.View style={[skeletonStyles.line1, { opacity }]} />
            <Animated.View style={[skeletonStyles.line2, { opacity }]} />
          </View>
          <Animated.View style={[skeletonStyles.badge, { opacity }]} />
        </View>
        <Animated.View style={[skeletonStyles.divider, { opacity }]} />
        <View style={skeletonStyles.chips}>
          <Animated.View style={[skeletonStyles.chip, { opacity }]} />
          <Animated.View style={[skeletonStyles.chip, { opacity, width: 68 }]} />
        </View>
      </View>
    </View>
  );
}

const BG = '#E5E7EB';
const skeletonStyles = StyleSheet.create({
  card:      { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radii.md, marginBottom: spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: '#EBEBF0' },
  accentBar: { width: 4, backgroundColor: BG, borderTopLeftRadius: radii.md, borderBottomLeftRadius: radii.md },
  inner:     { flex: 1, padding: spacing.md, paddingLeft: spacing.sm + 4, gap: spacing.sm },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar:    { width: 46, height: 46, borderRadius: radii.pill, backgroundColor: BG },
  lines:     { flex: 1, gap: 6 },
  line1:     { height: 13, width: '55%', backgroundColor: BG, borderRadius: 4 },
  line2:     { height: 11, width: '35%', backgroundColor: BG, borderRadius: 4 },
  badge:     { height: 24, width: 72, borderRadius: radii.pill, backgroundColor: BG },
  divider:   { height: 1, backgroundColor: BG },
  chips:     { flexDirection: 'row', gap: spacing.xs },
  chip:      { height: 26, width: 90, borderRadius: radii.sm, backgroundColor: BG },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter, onRefresh }: { filter: StatusFilter; onRefresh: () => void }) {
  const isAll = filter === 'all';
  return (
    <View style={emptyStyles.container}>
      <View style={emptyStyles.iconCircle}>
        <Ionicons name={isAll ? 'calendar-outline' : 'filter-outline'} size={36} color={colors.primary} />
      </View>
      <Text style={emptyStyles.title}>{isAll ? 'No Bookings Yet' : 'Nothing Here'}</Text>
      <Text style={emptyStyles.subtitle}>
        {isAll
          ? 'Your booked services will appear here. Browse nearby partners to get started.'
          : `No ${filter.replace('_', ' ')} bookings found. Try a different filter.`}
      </Text>
      {isAll && (
        <TouchableOpacity style={emptyStyles.cta} onPress={onRefresh} activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={15} color="#fff" />
          <Text style={emptyStyles.ctaText}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingHorizontal: spacing.xl, gap: spacing.sm },
  iconCircle: { width: 80, height: 80, borderRadius: radii.pill, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  title:      { fontFamily: fonts.jakartaSemiBold, fontSize: 18, color: colors.textPrimary },
  subtitle:   { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  cta:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, marginTop: spacing.xs },
  ctaText:    { fontFamily: fonts.jakartaSemiBold, fontSize: 13, color: '#fff' },
});

// ─── BookingsScreen ───────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const {
    bookings, activeFilter, loading, refreshing, loadingMore, error,
    setActiveFilter, refresh, loadMore, cancelBookingById, submitBookingReview,
  } = useBookings();

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailVisible,   setDetailVisible]   = useState(false);
  const [reviewBooking,   setReviewBooking]   = useState<Booking | null>(null);
  const [reviewVisible,   setReviewVisible]   = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [headerBottom,    setHeaderBottom]    = useState(0);

  const headerAnim  = useRef(new Animated.Value(0)).current;
  const chevronAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.timing(chevronAnim, { toValue: dropdownVisible ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [dropdownVisible, chevronAnim]);

  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const handleCardPress       = useCallback((b: Booking) => { setSelectedBooking(b); setDetailVisible(true); }, []);
  const handleCancelled       = useCallback((id: string) => { cancelBookingById(id).catch((e: any) => Alert.alert('Error', e?.message ?? 'Could not cancel.')); }, [cancelBookingById]);
  const handleReviewPress     = useCallback((b: Booking) => { setReviewBooking(b); setReviewVisible(true); }, []);
  const handleReviewSubmitted = useCallback(async (id: string, rating: number, comment: string) => {
    try { await submitBookingReview(id, rating, comment || undefined); }
    catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to submit.'); }
  }, [submitBookingReview]);
  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === 'home')    router.replace(ROUTES.APP.HOME    as any);
    if (route === 'profile') router.replace(ROUTES.APP.PROFILE as any);
  }, []);

  const activeCfg   = FILTER_COLORS[activeFilter];
  const activeLabel = FILTER_TABS.find((t) => t.key === activeFilter)?.label ?? 'All Bookings';
  const activeIcon  = FILTER_TABS.find((t) => t.key === activeFilter)?.icon  ?? 'list-outline';
  const isFiltered  = activeFilter !== 'all';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      {/* ── Header ── */}
      <Animated.View
        style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }]}
        onLayout={(e) => setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        {/* Row 1: title + refresh */}
        <View style={styles.headerRow1}>
          <Text style={styles.heading}>My Bookings</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={refresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Refresh">
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Row 2: filter pill (left) + booking count (right) */}
        <View style={styles.headerRow2}>
          <TouchableOpacity
            style={[styles.filterBtn, isFiltered && { backgroundColor: activeCfg.bg, borderColor: activeCfg.accent }]}
            onPress={() => setDropdownVisible((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${activeLabel}`}
          >
            <Ionicons name={activeIcon} size={13} color={isFiltered ? activeCfg.accent : colors.textSecondary} />
            <Text style={[styles.filterBtnText, isFiltered && { color: activeCfg.fg }]} numberOfLines={1}>
              {activeLabel}
            </Text>
            <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
              <Ionicons name="chevron-down" size={13} color={isFiltered ? activeCfg.accent : colors.textSecondary} />
            </Animated.View>
          </TouchableOpacity>

          {!loading && !error && (
            <Text style={styles.subheading}>
              {bookings.length > 0 ? `${bookings.length} booking${bookings.length !== 1 ? 's' : ''}` : 'No bookings'}
            </Text>
          )}
        </View>

        {/* Accent underline when a filter is active */}
        {isFiltered && <View style={[styles.activeFilterBar, { backgroundColor: activeCfg.accent }]} />}
      </Animated.View>

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}><Ionicons name="cloud-offline-outline" size={38} color={colors.primary} /></View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.85}>
            <Ionicons name="refresh" size={15} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState filter={activeFilter} onRefresh={refresh} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} /> : null}
          renderItem={({ item }) => <BookingCard booking={item} onPress={handleCardPress} />}
        />
      )}

      <BottomNav onNavigate={handleNavigate} />

      <FilterDropdown
        visible={dropdownVisible}
        activeFilter={activeFilter}
        anchorY={headerBottom}
        onSelect={setActiveFilter}
        onClose={() => setDropdownVisible(false)}
      />
      <BookingDetail visible={detailVisible} booking={selectedBooking} onClose={() => setDetailVisible(false)} onCancelled={handleCancelled} onReviewPress={handleReviewPress} />
      <ReviewModal   visible={reviewVisible} booking={reviewBooking}   onClose={() => setReviewVisible(false)} onSubmitted={handleReviewSubmitted} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F8',
    gap: spacing.xs + 2,
  },
  headerRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft:  { gap: 2 },
  heading:     { fontFamily: fonts.oswaldSemiBold, fontSize: 26, color: '#1C1C28', letterSpacing: 0.3 },
  subheading:  { fontFamily: fonts.jostRegular, fontSize: 12, color: '#626262' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 3,
    borderRadius: radii.pill,
    backgroundColor: '#F7F7FB',
    borderWidth: 1,
    borderColor: '#EBEBF0',
    maxWidth: 160,
  },
  filterBtnText: { fontFamily: fonts.jakartaMedium, fontSize: 12, color: '#626262', flex: 1 },

  activeFilterBar: { height: 2, borderRadius: radii.pill, marginTop: spacing.xs },

  refreshBtn: { width: 36, height: 36, borderRadius: radii.pill, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },

  listContent:      { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 120, flexGrow: 1 },
  skeletonContainer:{ paddingHorizontal: spacing.md, paddingTop: spacing.md },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: spacing.sm },
  errorIconWrap:  { width: 76, height: 76, borderRadius: radii.pill, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  errorTitle:     { fontFamily: fonts.jakartaSemiBold, fontSize: 16, color: '#1C1C28' },
  errorMsg:       { fontFamily: fonts.jostRegular, fontSize: 13, color: '#626262', textAlign: 'center', lineHeight: 20 },
  retryBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#16493c', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radii.pill, marginTop: spacing.xs },
  retryText:      { fontFamily: fonts.jakartaSemiBold, fontSize: 13, color: '#fff' },
});
