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
import PromoBanner from './PromoBanner';
import BottomNav from './BottomNav';
import CategoryGrid, { CategoryGridSkeleton } from './CategoryGrid';

import { useNearbyServices } from '@/hooks/useNearbyServices';
import type { NearbyCategory } from '@/api/nearby.api';

import { PromoOffer, NavRoute } from './types';
import { colors, spacing, radii, typography } from './theme';
import { useAuth } from '@/providers/AuthProvider';
import { ROUTES } from '@/constants/routes';
import type { Address } from './Header';

// ─── Static promo (replace with real API when ready) ─────────────────────────

const PROMO_OFFER: PromoOffer = {
  discountPercent: 10,
  description: 'Discount for every cleaning order',
  serviceName: 'Floor Cleaning',
  servicePrice: 25,
  image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400',
};

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
              offer={PROMO_OFFER}
              onBookPress={() => console.log('Book floor cleaning')}
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
  },
  titleBlock: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
  },
  titleGreeting: {
    ...typography.greeting,
    fontFamily: 'Oswald_600Regular',
    fontSize: 19,
    letterSpacing: 0.4,
  },
  titleTagline: {
    ...typography.heading,
    fontSize: 32,
    color: colors.white,
    lineHeight: 30,
    letterSpacing: 0.2,
  },

  // ── White content card: overlaps hero with rounded top corners ───────────────
  contentCard: {
    flex: 1,              // ← stretches to fill remaining scroll space; fixes the bottom gap
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    marginTop: -28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 18,
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