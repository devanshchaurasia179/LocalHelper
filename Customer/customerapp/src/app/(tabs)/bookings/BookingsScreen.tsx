import { useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing, radii, typography } from '../home/theme';
import { useBookings } from '@/hooks/useBookings';
import BookingCard from './BookingCard';
import BookingDetail from './BookingDetail';
import ReviewModal from './ReviewModal';
import BottomNav from '../home/BottomNav';
import { useState, useCallback } from 'react';
import type { Booking, StatusFilter } from './bookings.types';
import type { NavRoute } from '../home/types';
import { ROUTES } from '@/constants/routes';

// ─── Filter tab config ────────────────────────────────────────────────────────

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',         label: 'All'        },
  { key: 'pending',     label: 'Pending'    },
  { key: 'accepted',    label: 'Accepted'   },
  { key: 'in_progress', label: 'In Progress'},
  { key: 'completed',   label: 'Completed'  },
  { key: 'cancelled',   label: 'Cancelled'  },
];

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: StatusFilter }) {
  const message =
    filter === 'all'
      ? "You haven't made any bookings yet."
      : `No ${filter.replace('_', ' ')} bookings found.`;
  return (
    <View style={emptyStyles.container}>
      <Ionicons name="calendar-outline" size={56} color="#D1D5DB" />
      <Text style={emptyStyles.title}>No Bookings</Text>
      <Text style={emptyStyles.subtitle}>{message}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl * 2,
    gap: spacing.sm,
  },
  title: { ...typography.name, fontSize: 18, color: colors.textPrimary },
  subtitle: { ...typography.caption, textAlign: 'center', paddingHorizontal: spacing.xl },
});

// ─── BookingsScreen ───────────────────────────────────────────────────────────

export default function BookingsScreen() {
  // All data + async logic lives in the hook
  const {
    bookings,
    activeFilter,
    loading,
    refreshing,
    loadingMore,
    error,
    setActiveFilter,
    refresh,
    loadMore,
    cancelBookingById,
    submitBookingReview,
  } = useBookings();

  // Detail / review modal state (UI only — no data fetching)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);

  // Header fade-in on mount
  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleCardPress = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setDetailVisible(true);
  }, []);

  const handleCancelled = useCallback(
    (bookingId: string) => {
      cancelBookingById(bookingId).catch((err: any) => {
        Alert.alert('Error', err?.message ?? 'Could not cancel booking. Try again.');
      });
    },
    [cancelBookingById],
  );

  const handleReviewPress = useCallback((booking: Booking) => {
    setReviewBooking(booking);
    setReviewVisible(true);
  }, []);

  const handleReviewSubmitted = useCallback(
    async (bookingId: string, rating: number, comment: string) => {
      try {
        await submitBookingReview(bookingId, rating, comment || undefined);
      } catch (err: any) {
        Alert.alert('Error', err?.message ?? 'Failed to submit review. Try again.');
      }
    },
    [submitBookingReview],
  );

  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === 'home')    router.replace(ROUTES.APP.HOME as any);
    if (route === 'profile') router.replace(ROUTES.APP.PROFILE as any);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <Animated.View style={[styles.headerRow, { opacity: headerAnim }]}>
        <Text style={styles.heading}>My Bookings</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={refresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Refresh bookings"
        >
          <Ionicons name="refresh-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Filter tabs */}
      <FlatList
        data={FILTER_TABS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.filtersContainer}
        renderItem={({ item }) => {
          const isActive = item.key === activeFilter;
          return (
            <TouchableOpacity
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(item.key)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
        style={styles.filtersList}
      />

      {/* Main content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="#D1D5DB" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState filter={activeFilter} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: spacing.md }}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <BookingCard booking={item} onPress={handleCardPress} />
          )}
        />
      )}

      {/* Bottom nav */}
      <BottomNav onNavigate={handleNavigate} />

      {/* Detail modal */}
      <BookingDetail
        visible={detailVisible}
        booking={selectedBooking}
        onClose={() => setDetailVisible(false)}
        onCancelled={handleCancelled}
        onReviewPress={handleReviewPress}
      />

      {/* Review modal */}
      <ReviewModal
        visible={reviewVisible}
        booking={reviewBooking}
        onClose={() => setReviewVisible(false)}
        onSubmitted={handleReviewSubmitted}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  heading: {
    ...typography.heading,
    fontSize: 26,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersList: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  filtersContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 120,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
