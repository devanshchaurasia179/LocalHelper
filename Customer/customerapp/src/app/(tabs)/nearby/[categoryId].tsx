import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Animated,
  Easing,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { fetchNearbyServices } from '@/api/nearby.api';
import type { NearbyPartner } from '@/api/nearby.api';
import { nearbyCache } from '@/cache/nearbyCache';
import PartnerCard from './PartnerCard';
import PartnerDetailSheet from '../home/PartnerDetailSheet';
import { colors, spacing, radii, typography } from '../home/theme';

// ─── Sort options ───────────────────────────────────────────────────────────

type SortKey = 'recommended' | 'nearest' | 'rating';

const SORT_OPTIONS: { key: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'recommended', label: 'Recommended', icon: 'sparkles-outline' },
  { key: 'nearest', label: 'Nearest', icon: 'navigate-outline' },
  { key: 'rating', label: 'Top rated', icon: 'star-outline' },
];

// Some APIs nest these fields slightly differently — read defensively so
// sorting/searching never throws if a field is missing.
function getName(p: NearbyPartner): string {
  return (p as any).name ?? (p as any).businessName ?? '';
}
function getDistanceKm(p: NearbyPartner): number {
  const d = (p as any).distanceKm ?? (p as any).distance;
  return typeof d === 'number' ? d : Number.POSITIVE_INFINITY;
}
function getRating(p: NearbyPartner): number {
  const r = (p as any).rating ?? (p as any).avgRating;
  return typeof r === 'number' ? r : 0;
}

// ─── Shimmering skeleton ────────────────────────────────────────────────────

function PartnerCardSkeleton({ delay = 0 }: { delay?: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer, delay]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <View style={skeletonStyles.card}>
      <Animated.View style={[skeletonStyles.avatar, { opacity }]} />
      <View style={skeletonStyles.body}>
        <Animated.View style={[skeletonStyles.line1, { opacity }]} />
        <Animated.View style={[skeletonStyles.line2, { opacity }]} />
        <Animated.View style={[skeletonStyles.line3, { opacity }]} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: '#E5E7EB',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  line1: { height: 14, width: '55%', backgroundColor: '#E5E7EB', borderRadius: 4 },
  line2: { height: 11, width: '40%', backgroundColor: '#E5E7EB', borderRadius: 4 },
  line3: { height: 10, width: '70%', backgroundColor: '#E5E7EB', borderRadius: 4, marginTop: 4 },
});

// ─── Animated row wrapper (fade + rise-in on first appearance) ─────────────

function AnimatedRow({ index, children }: { index: number; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 6) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, index]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CategoryPartnersScreen() {
  const { categoryId, categoryName } = useLocalSearchParams<{
    categoryId: string;
    categoryName: string;
  }>();

  // Seed from cache immediately — no GPS call, no shimmer on first open
  const cachedPartners = useMemo(
    () => nearbyCache.getPartnersByCategory(categoryId ?? ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryId]
  );

  const [partners, setPartners] = useState<NearbyPartner[]>(cachedPartners);
  // If we already have cached data, skip the loading state entirely
  const [loading, setLoading] = useState(cachedPartners.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<NearbyPartner | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recommended');

  const scrollY = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);

      // Re-use cached coords to avoid a redundant GPS round-trip
      let coords = nearbyCache.getCoords() ?? undefined;

      if (!coords) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationDenied(false);
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          nearbyCache.setCoords(coords);
        } else {
          setLocationDenied(true);
        }
      }

      const res = await fetchNearbyServices({ ...coords, categoryId });
      nearbyCache.setPartners(res.data.services);
      setPartners(res.data.services.filter((p) =>
        p.categories.some((c) => c._id === categoryId)
      ));
    } catch (err: any) {
      if (!silent) {
        setError(
          err?.response?.data?.message ?? 'Could not load partners. Pull to refresh.'
        );
      }
    }
  }, [categoryId]);

  useEffect(() => {
    if (cachedPartners.length === 0) {
      // No cache — show skeleton and wait
      setLoading(true);
      load().finally(() => setLoading(false));
    } else {
      // Cache hit — show data instantly, refresh quietly in background
      // only if the cache is stale (> 1 minute old)
      if (nearbyCache.isStale()) {
        load(true);
      }
    }
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visiblePartners = useMemo(() => {
    let list = partners;

    if (query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => getName(p).toLowerCase().includes(q));
    }

    if (sortKey === 'nearest') {
      list = [...list].sort((a, b) => getDistanceKm(a) - getDistanceKm(b));
    } else if (sortKey === 'rating') {
      list = [...list].sort((a, b) => getRating(b) - getRating(a));
    }

    return list;
  }, [partners, query, sortKey]);

  const title = categoryName ?? 'Nearby Partners';

  const headerElevation = scrollY.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Header ── */}
      <Animated.View
        style={[
          styles.header,
          {
            shadowOpacity: headerElevation.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
            elevation: headerElevation.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) as any,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            {!loading && !error && (
              <Text style={styles.headerSubtitle}>
                {visiblePartners.length} of {partners.length} partner
                {partners.length !== 1 ? 's' : ''}
                {query ? ' matching' : ' available nearby'}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setSearchOpen((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close search' : 'Search partners'}
          >
            <Ionicons name={searchOpen ? 'close' : 'search'} size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        {searchOpen && (
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.navInactive} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${title.toLowerCase()}...`}
              placeholderTextColor={colors.navInactive}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.navInactive} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {!loading && !error && partners.length > 0 && (
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((opt) => {
              const active = sortKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setSortKey(opt.key)}
                  style={[styles.sortChip, active && styles.sortChipActive]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={opt.icon}
                    size={13}
                    color={active ? colors.primary : 'rgba(255,255,255,0.85)'}
                  />
                  <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Animated.View>

      {locationDenied && !loading && !error && (
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={16} color="#92400E" />
          <Text style={styles.locationBannerText}>
            Turn on location to see partners sorted by distance.
          </Text>
        </View>
      )}

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.scrollContent}>
          {[0, 1, 2, 3].map((i) => (
            <PartnerCardSkeleton key={i} delay={i * 90} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.centeredMessage}>
          <View style={styles.iconBubble}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.85}>
            <Ionicons name="refresh" size={16} color={colors.white} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : visiblePartners.length === 0 ? (
        <View style={styles.centeredMessage}>
          <View style={styles.iconBubble}>
            <Ionicons
              name={query ? 'search-outline' : 'storefront-outline'}
              size={40}
              color={colors.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {query ? 'No matches' : 'No Partners Found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {query
              ? `Nothing matches "${query}". Try a different search.`
              : `No ${title} providers are available near your location right now.`}
          </Text>
          {query ? (
            <TouchableOpacity style={styles.retryBtn} onPress={() => setQuery('')} activeOpacity={0.85}>
              <Text style={styles.retryText}>Clear search</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.85}>
              <Ionicons name="refresh" size={16} color={colors.white} />
              <Text style={styles.retryText}>Refresh</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Animated.FlatList
          data={visiblePartners}
          keyExtractor={(item: NearbyPartner) => item._id}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item, index }) => (
            <AnimatedRow index={index}>
              <PartnerCard partner={item} onPress={() => setSelectedPartner(item)} />
            </AnimatedRow>
          )}
        />
      )}

      {/* ── Partner detail + booking sheet ── */}
      <PartnerDetailSheet
        partner={selectedPartner}
        visible={selectedPartner !== null}
        onClose={() => setSelectedPartner(null)}
        onBooked={() => {
          setSelectedPartner(null);
          refresh();
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.70)',
    marginTop: 2,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 40,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
    ...Platform.select({ android: { paddingVertical: 0 } }),
  },

  // Sort chips
  sortRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  sortChipActive: {
    backgroundColor: colors.white,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  sortChipTextActive: {
    color: colors.primary,
  },

  // Location banner
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
  },

  // Content
  scrollContent: {
    padding: spacing.md,
    flexGrow: 1,
  },

  // Empty / error states
  centeredMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
    paddingHorizontal: spacing.xl ?? 32,
    gap: spacing.sm,
  },
  iconBubble: {
    width: 84,
    height: 84,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  errorTitle: {
    ...typography.body,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorText: {
    ...typography.body,
    color: '#EF4444',
    textAlign: 'center',
    maxWidth: 280,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  retryText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyTitle: {
    ...typography.body,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    ...typography.caption,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});