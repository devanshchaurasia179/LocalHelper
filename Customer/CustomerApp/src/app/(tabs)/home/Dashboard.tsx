import { useState, useCallback } from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  RefreshControl,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import Header from './Header';
import SearchBar from './SearchBar';
import PromoBanner, { PromoSlide } from './PromoBanner';
import BottomNav from './BottomNav';
import CategoryGrid, { CategoryGridSkeleton } from './CategoryGrid';

import { useNearbyServices } from '@/hooks/useNearbyServices';
import type { NearbyCategory } from '@/api/nearby.api';

import { NavRoute } from './types';
import { colors, spacing, radii, typography } from './theme';
import { useAuth } from '@/providers/AuthProvider';
import { ROUTES } from '@/constants/routes';
import type { Address } from './Header';

// ─── Static promos (replace with real API when ready) ────────────────────────

const PROMO_SLIDES: PromoSlide[] = [
  {
    // Slide 1 — deep forest green (brand primary)
    discountPercent: 10,
    badgeLabel: 'LIMITED OFFER',
    description: 'Discount for every cleaning order this week',
    serviceName: 'Floor Cleaning',
    servicePrice: 25,
    gradientColors: ['#16493c', '#0d2e26'],
    accentColor: 'rgba(255,255,255,0.20)',
  },
  {
    // Slide 2 — warm teal-to-cyan; adjacent to green on the wheel
    discountPercent: 15,
    badgeLabel: 'FLASH DEAL',
    description: 'Fast & reliable plumbers at your doorstep',
    serviceName: 'Plumbing Fix',
    servicePrice: 35,
    gradientColors: ['#0e6655', '#084a3d'],
    accentColor: 'rgba(255,255,255,0.20)',
  },
  {
    // Slide 3 — deep olive-charcoal; earthy & cohesive with the green family
    discountPercent: 20,
    badgeLabel: 'WEEKEND SPECIAL',
    description: 'Expert electricians for all your home needs',
    serviceName: 'Electrical Work',
    servicePrice: 45,
    gradientColors: ['#1b3a2f', '#102820'],
    accentColor: 'rgba(255,255,255,0.20)',
  },
];

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { customer } = useAuth();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);

  const { services, loading, refreshing, error, refresh } = useNearbyServices();

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

  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === 'profile')  router.replace(ROUTES.APP.PROFILE as any);
    if (route === 'bookings') router.replace(ROUTES.APP.BOOKINGS as any);
  }, []);

  const handleCategoryPress = useCallback((category: NearbyCategory) => {
    router.push({
      pathname: '/(tabs)/nearby/[categoryId]',
      params: { categoryId: category._id, categoryName: category.name },
    } as any);
  }, []);

  const firstName = customer?.name?.split(' ')[0] ?? 'there';
  const addresses: Address[] = (customer?.addresses ?? []) as Address[];

  // Filter categories by search query
  const filteredCategories = nearbyCategories.filter((cat) => {
    if (!searchQuery.trim()) return true;
    return cat.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
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
            onNotificationPress={() => console.log('Open notifications')}
          />
          <View style={styles.titleBlock}>
            <Text style={styles.titleGreeting}>Hello, {firstName} </Text>
            <Text style={styles.titleTagline}>From Hassles To{'\n'}Solutions In One Tap.</Text>
          </View>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFilterPress={() => console.log('Open filters')}
          />
        </View>

        {/* ── Content card: white sheet overlapping hero bottom ── */}
        <View style={styles.contentCard}>
          {/* drag handle */}
          <View style={styles.handle} />

          <View style={styles.promoBannerWrapper}>
            <PromoBanner
              slides={PROMO_SLIDES}
              onBookPress={(slide) => console.log('Book', slide.serviceName)}
            />
          </View>

          {/* ── Nearby Services ── */}
          <Text style={styles.sectionTitle}>Nearby Services</Text>
          <Text style={styles.sectionSubtitle}>Choose a service to find available partners</Text>

          {loading ? (
            <CategoryGridSkeleton />
          ) : error ? (
            <View style={styles.messageContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : filteredCategories.length === 0 ? (
            <View style={styles.messageContainer}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No services match your search.'
                  : 'No service categories available right now.'}
              </Text>
            </View>
          ) : (
            <CategoryGrid
              categories={filteredCategories}
              onCategoryPress={handleCategoryPress}
            />
          )}
        </View>
      </ScrollView>

      <BottomNav onNavigate={handleNavigate} />
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
    ...typography.heading,
    fontSize: 30,
    color: colors.white,
    lineHeight: 38,
    letterSpacing: 0.1,
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

  // ── Promo banner ─────────────────────────────────────────────────────────────
  promoBannerWrapper: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  sectionTitle: {
    ...typography.heading,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  messageContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: '#E53935',
    textAlign: 'center',
  },
  emptyText: {
    ...typography.caption,
    textAlign: 'center',
  },
});