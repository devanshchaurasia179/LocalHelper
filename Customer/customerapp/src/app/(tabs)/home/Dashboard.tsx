import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  RefreshControl,
  View,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import Header from './Header';
import SearchBar from './SearchBar';
import RotatingText from './RotatingText';
import BottomNav from './BottomNav';
import NearbyServicesSection, { NearbyServicesSkeleton } from './NearbyServicesSection';
import NearbyEmptyState from './NearbyEmptyState';
import ActiveBookingCard from './ActiveBookingCard';
import RecentCallCard from './RecentCallCard';
import CallScreen from '@/components/call/CallScreen';
import FilterDropdown from './FilterModal';
import SearchDropdown from './SearchModal';

import { useNearbyServices } from '@/hooks/useNearbyServices';
import { useWalletSummary } from '@/hooks/useWallet';
import type { NearbyCategory } from '@/api/nearby.api';
import { initiateCallToPartner } from '@/api/call.api';

import { nearbyCache } from '@/cache/nearbyCache';
import { NavRoute } from './types';
import { colors, spacing, radii, typography, fonts } from './theme';
import { useAuth } from '@/providers/AuthProvider';
import { ROUTES } from '@/constants/routes';
import type { Address } from './Header';

// ─── Rotating hero taglines (the big moving text) ─────────────────────────────
// Each phrase slides through the hero like a carousel. Use \n to control the
// line break so the two-line layout stays consistent.

const HERO_TAGLINES: string[] = [
  'From Hassles To\nSolutions In One Tap.',
  'Trusted Local Helpers\nAt Your Doorstep.',
  'Book Verified Partners\nIn Just One Tap.',
];

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { customer } = useAuth();
  const insets = useSafeAreaInsets();
  const { summary: walletSummary, refresh: refreshWallet } = useWalletSummary();

  // Re-fetch the wallet balance every time the home tab regains focus so the
  // header stays in sync with the wallet screen after top-ups, bookings, or
  // calls. Tabs use `freezeOnBlur`, so without this the balance would only
  // reflect the value fetched on the very first mount.
  useFocusEffect(
    useCallback(() => {
      refreshWallet();
    }, [refreshWallet]),
  );
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);

  // ── Call screen state ──────────────────────────────────────────────────────
  const [callScreenVisible, setCallScreenVisible] = useState(false);
  const [callId, setCallId] = useState('');
  const [callLivekitUrl, setCallLivekitUrl] = useState('');
  const [callLivekitToken, setCallLivekitToken] = useState('');
  const [callPartnerInfo, setCallPartnerInfo] = useState<{
    _id: string; fullName: string; profilePhoto?: string | null;
  } | null>(null);

  const handleEndCall = useCallback(() => {
    setCallScreenVisible(false);
    setCallId('');
    setCallLivekitUrl('');
    setCallLivekitToken('');
    setCallPartnerInfo(null);
  }, []);

  const addresses: Address[] = (customer?.addresses ?? []) as Address[];

  // Derive coordinates from the currently selected address so the initial
  // fetch uses the saved address location, not the device's live GPS.
  const selectedAddressCoords = useMemo(() => {
    const addr = addresses[selectedAddressIndex];
    if (addr?.location?.coordinates?.length === 2) {
      const [lng, lat] = addr.location.coordinates;
      return { lat, lng };
    }
    return undefined;
  }, [addresses, selectedAddressIndex]);

  // Keep the shared cache in sync whenever the selected address changes so
  // [categoryId].tsx always has the right coords without its own GPS call.
  useEffect(() => {
    nearbyCache.setCoords(selectedAddressCoords ?? null);
  }, [selectedAddressCoords]);

  const { services, loading, refreshing, error, refresh } = useNearbyServices(selectedAddressCoords);

  // Pull-to-refresh must reuse the selected address coords. RefreshControl
  // calls onRefresh with a native event (not coords), so calling `refresh`
  // directly would send no lat/lng and make the backend fall back to the
  // saved currentLocation — returning a different, smaller set of partners.
  const handlePullToRefresh = useCallback(() => {
    refresh(selectedAddressCoords);
    refreshWallet();
  }, [refresh, selectedAddressCoords, refreshWallet]);

  // Derive unique categories from nearby partners — only categories that
  // actually have at least one available partner nearby are shown.
  const nearbyCategories: NearbyCategory[] = (() => {
    const seen = new Set<string>();
    const result: NearbyCategory[] = [];
    for (const partner of services) {
      for (const cat of partner.categories) {
        if (!seen.has(cat._id)) {
          seen.add(cat._id);
          result.push(cat);
        }
      }
    }
    return result;
  })();

  // Count available partners per subcategory across all categories
  const subcategoryPartnerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const partner of services) {
      for (const sub of partner.subcategories ?? []) {
        counts.set(sub.subcategoryId, (counts.get(sub.subcategoryId) ?? 0) + 1);
      }
    }
    return counts;
  }, [services]);

  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === 'home') return; // Already here
    if (route === 'profile')  router.navigate(ROUTES.APP.PROFILE  as any);
    if (route === 'bookings') router.navigate(ROUTES.APP.BOOKINGS as any);
    if (route === 'chat')     router.navigate(ROUTES.APP.CHAT     as any);
    if (route === 'wallet')   router.navigate(ROUTES.APP.WALLET   as any);
  }, []);

  const handleCategoryPress = useCallback((category: NearbyCategory) => {
    router.push({
      pathname: '/(tabs)/nearby/[categoryId]',
      params: { categoryId: category._id, categoryName: category.name },
    } as any);
  }, []);

  const firstName = customer?.name?.split(' ')[0] ?? 'there';

  // ── Filter state ───────────────────────────────────────────────────────────
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{
    subcategoryIds: string[];
    onlineOnly: boolean;
    maxDistance: number | null; // km, null = no limit
  }>({ subcategoryIds: [], onlineOnly: true, maxDistance: null });

  // Determine if any filter is active (for badge indicator)
  const hasActiveFilters =
    activeFilters.subcategoryIds.length > 0 ||
    activeFilters.onlineOnly ||
    activeFilters.maxDistance !== null;

  // ── Filter logic (only filters affect the nearby section, NOT search) ─────
  const filteredCategories = useMemo(() => {
    if (!hasActiveFilters) return nearbyCategories;

    let results = nearbyCategories;

    // Apply subcategory filter from FilterModal — keep categories that contain
    // at least one of the selected subcategories.
    if (activeFilters.subcategoryIds.length > 0) {
      const selected = new Set(activeFilters.subcategoryIds);
      results = results.filter((cat) =>
        (cat.subcategories ?? []).some((sub) => selected.has(sub._id))
      );
    }

    // Apply distance filter — exclude categories where no partner is within the max distance
    if (activeFilters.maxDistance !== null) {
      const maxDist = activeFilters.maxDistance;
      const categoriesWithNearbyPartners = new Set<string>();
      for (const partner of services) {
        if (partner.distanceKm <= maxDist) {
          for (const cat of partner.categories) {
            categoriesWithNearbyPartners.add(cat._id);
          }
        }
      }
      results = results.filter((cat) => categoriesWithNearbyPartners.has(cat._id));
    }

    // Apply online-only filter
    if (activeFilters.onlineOnly) {
      const onlineCategories = new Set<string>();
      for (const partner of services) {
        if (partner.isOnline) {
          for (const cat of partner.categories) {
            onlineCategories.add(cat._id);
          }
        }
      }
      results = results.filter((cat) => onlineCategories.has(cat._id));
    }

    return results;
  }, [nearbyCategories, activeFilters, hasActiveFilters, services]);

  return (
    // edges={['bottom']} — no top safe-area inset so hero touches the status bar
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} />
        }
      >
        {/* ── Hero: scrolls with the page ── */}
        <View style={[styles.heroCard, { paddingTop: insets.top }]}>
          {/* ── Decorative triangles ── */}
          <View style={styles.triTopRight}       pointerEvents="none" />
          <View style={styles.triTopRightInner}  pointerEvents="none" />
          <View style={styles.triBottomLeft}     pointerEvents="none" />
          <View style={styles.triMidRight}       pointerEvents="none" />
          <View style={styles.triMidLeft}        pointerEvents="none" />
          {/* extra triangles */}
          <View style={styles.triTopLeft}        pointerEvents="none" />
          <View style={styles.triBottomRight}    pointerEvents="none" />
          <View style={styles.triCenterFloatA}   pointerEvents="none" />
          <View style={styles.triCenterFloatB}   pointerEvents="none" />
          <View style={styles.triBottomCenter}   pointerEvents="none" />

          <Header
            addresses={addresses}
            selectedIndex={selectedAddressIndex}
            onSelectAddress={setSelectedAddressIndex}
            walletBalance={walletSummary?.walletBalance}
            onChatPress={() => router.navigate(ROUTES.APP.CHAT as any)}
            onWalletPress={() => router.navigate(ROUTES.APP.WALLET as any)}
            onLocationChange={(coords) => {
              // coords are also written to nearbyCache via the useEffect above;
              // but write eagerly here too so [categoryId] gets them immediately.
              nearbyCache.setCoords(coords ?? null);
              refresh(coords);
            }}
          />
          <View style={styles.titleBlock}>
            <Text style={styles.titleGreeting}>Hello, {firstName} </Text>
            {/* Big hero tagline as a moving carousel — each phrase slides
                out to the left and the next slides in from the right. */}
            <RotatingText
              items={HERO_TAGLINES}
              textStyle={styles.titleTagline}
              numberOfLines={2}
              align="flex-start"
              holdDuration={2600}
              transitionDuration={550}
            />
          </View>

          <SearchBar
            onPress={() => setSearchModalVisible(true)}
            onFilterPress={() => setFilterModalVisible(true)}
            hasActiveFilters={hasActiveFilters}
          />
        </View>

        {/* ── Content card: white sheet overlapping hero bottom ── */}
        <View style={styles.contentCard}>
          {/* drag handle */}
          <View style={styles.handle} />

          {/* ── Recent Call ── */}
          <RecentCallCard
            onCallPartner={async (partnerId, partnerInfo) => {
              try {
                setCallPartnerInfo({ _id: partnerId, ...partnerInfo });
                const res = await initiateCallToPartner(partnerId);
                if (!res.success || !res.livekit) {
                  setCallPartnerInfo(null);
                  Alert.alert('Call Failed', res.message ?? 'Could not reach partner. Try again later.');
                  return;
                }
                // Show the call screen directly
                setCallId(res.call?.id ?? '');
                setCallLivekitUrl(res.livekit.url);
                setCallLivekitToken(res.livekit.token);
                setCallScreenVisible(true);
              } catch (err: any) {
                setCallPartnerInfo(null);
                const msg = err?.response?.data?.message ?? 'Could not initiate call. Try again.';
                Alert.alert('Call Failed', msg);
              }
            }}
          />

          {/* ── Active Booking ── */}
          <ActiveBookingCard />

          {/* ── Nearby Services ── */}
          <Text style={styles.sectionTitle}>Nearby Services</Text>
          <Text style={styles.sectionSubtitle}>Choose a service to find available partners</Text>

          {loading ? (
            <NearbyServicesSkeleton />
          ) : error ? (
            <NearbyEmptyState
              variant="error"
              message={error}
              onRetry={handlePullToRefresh}
            />
          ) : filteredCategories.length === 0 ? (
            // Distinguish "filters hid everything" from "nothing nearby at all":
            // if partners exist but filters removed them, guide the user to
            // clear filters; otherwise there are genuinely no services nearby.
            nearbyCategories.length > 0 && hasActiveFilters ? (
              <NearbyEmptyState
                variant="filtered"
                onClearFilters={() =>
                  setActiveFilters({ subcategoryIds: [], onlineOnly: false, maxDistance: null })
                }
              />
            ) : (
              <NearbyEmptyState
                variant="no-services"
                onRetry={handlePullToRefresh}
              />
            )
          ) : (
            <NearbyServicesSection
              categories={filteredCategories}
              partnerCounts={subcategoryPartnerCounts}
              onCategoryPress={handleCategoryPress}
              onSubcategoryPress={(category, subId, subName) => {
                router.push({
                  pathname: '/(tabs)/nearby/[categoryId]',
                  params: {
                    categoryId: category._id,
                    categoryName: category.name,
                    subcategoryId: subId,
                    subcategoryName: subName,
                  },
                } as any);
              }}
            />
          )}
        </View>
      </ScrollView>

      <BottomNav onNavigate={handleNavigate} />

      {/* ── Call Screen (LiveKit) ── */}
      {callScreenVisible && callPartnerInfo && (
        <CallScreen
          visible={callScreenVisible}
          partner={callPartnerInfo as any}
          callId={callId}
          livekitUrl={callLivekitUrl}
          livekitToken={callLivekitToken}
          onEndCall={handleEndCall}
        />
      )}

      {/* ── Filter Dropdown Card ── */}
      <FilterDropdown
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        categories={nearbyCategories}
        subcategoryPartnerCounts={subcategoryPartnerCounts}
        activeFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters);
          setFilterModalVisible(false);
        }}
      />

      {/* ── Search Dropdown Card ── */}
      <SearchDropdown
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        categories={nearbyCategories}
        partnerCounts={subcategoryPartnerCounts}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,  // white — matches content card, no gap at bottom
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,          // lets contentCard's flex: 1 actually have room to grow into
    backgroundColor: colors.background,
  },

  // ── Hero: sits flush at top, scrolls with page ───────────────────────────────
  heroCard: {
    backgroundColor: colors.primary,
    paddingBottom: spacing.xl + 24,      // extra so content card overlap doesn't clip content
    overflow: 'hidden',                  // clip decorative triangles to the card
  },

  // ── Decorative triangles — CSS border trick ───────────────────────────────
  // Each triangle is a zero-size View; visible border on two sides forms the shape.

  // Large triangle — top-right corner, pointing inward
  triTopRight: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 140,
    borderBottomWidth: 140,
    borderLeftColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  // Slightly smaller, offset inward — layered depth
  triTopRightInner: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 90,
    borderBottomWidth: 90,
    borderLeftColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  // Medium triangle — bottom-left, pointing up-right
  triBottomLeft: {
    position: 'absolute',
    bottom: 28,
    left: -20,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderRightWidth: 110,
    borderTopWidth: 110,
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  // Small triangle — right-center, accent
  triMidRight: {
    position: 'absolute',
    top: '42%',
    right: 30,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 50,
    borderBottomWidth: 50,
    borderLeftColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    transform: [{ rotate: '20deg' }],
  },
  // Tiny triangle — left-center, subtle
  triMidLeft: {
    position: 'absolute',
    top: '35%',
    left: 20,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderRightWidth: 36,
    borderTopWidth: 36,
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.05)',
    transform: [{ rotate: '-15deg' }],
  },

  // ── Extra triangles ──────────────────────────────────────────────────────────

  // Medium — top-left corner, tilted outward
  triTopLeft: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderRightWidth: 100,
    borderBottomWidth: 100,
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.05)',
    transform: [{ rotate: '10deg' }],
  },
  // Large — bottom-right corner, pointing up-left
  triBottomRight: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 130,
    borderTopWidth: 130,
    borderLeftColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '-5deg' }],
  },
  // Small — floating center-left, rotated for dynamism
  triCenterFloatA: {
    position: 'absolute',
    top: '55%',
    left: '38%',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 28,
    borderBottomWidth: 28,
    borderLeftColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.07)',
    transform: [{ rotate: '45deg' }],
  },
  // Tiny — upper-center, very faint
  triCenterFloatB: {
    position: 'absolute',
    top: '18%',
    left: '52%',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderRightWidth: 44,
    borderTopWidth: 44,
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.04)',
    transform: [{ rotate: '-30deg' }],
  },
  // Medium — bottom-center, pointing right
  triBottomCenter: {
    position: 'absolute',
    bottom: 40,
    left: '42%',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 60,
    borderBottomWidth: 0,
    borderLeftWidth: 34,
    borderRightWidth: 34,
    borderTopColor: 'rgba(255,255,255,0.05)',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '25deg' }],
  },
  titleBlock: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: 6,
  },
  titleGreeting: {
    ...typography.greeting,
    fontSize: 14,
    letterSpacing: 0.3,
    opacity: 0.85,
  },
  titleTagline: {
    ...typography.heroTagline,
  },

  // ── White content card: overlaps hero with rounded top corners ───────────────
  contentCard: {
    flex: 1,              // ← stretches to fill remaining scroll space; fixes the bottom gap
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    marginTop: -28,
    // Shadow color matches the hero green so it bleeds upward into the card above,
    // creating a convincing lift-and-overlap feel on both iOS and Android.
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 24,
    paddingBottom: 85,
  },

  // drag handle at top of content card
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navInactive,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },

  sectionTitle: {
    ...typography.heading,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.caption,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
});