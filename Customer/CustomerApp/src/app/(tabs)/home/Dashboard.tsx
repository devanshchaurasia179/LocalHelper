import { useState, useCallback } from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import Header from './Header';
import SearchBar from './SearchBar';
import PromoBanner from './PromoBanner';
import ServiceGrid from './ServiceGrid';
import BottomNav from './BottomNav';
import PartnerDetailSheet from './PartnerDetailSheet';

import { useNearbyServices } from '@/hooks/useNearbyServices';
import type { NearbyPartner } from '@/api/nearby.api';

import { Provider, PromoOffer, NavRoute } from './types';
import { colors, spacing } from './theme';
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

// ─── Map backend NearbyPartner → UI Provider ──────────────────────────────────

function toProvider(partner: NearbyPartner): Provider {
  return {
    id: partner._id,
    name: partner.fullName,
    category: partner.categories[0]?.name ?? 'General',
    // visitingCredits acts as hourly rate; 0 means free / negotiable
    pricePerHour: partner.visitingCredits ?? 0,
    rating: partner.averageRating ?? 0,
    image: partner.profilePhoto
      ? partner.profilePhoto
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.fullName)}&background=6C63FF&color=fff&size=300`,
    distanceKm: partner.distanceKm,
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { customer } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);
  const [selectedPartner, setSelectedPartner] = useState<NearbyPartner | null>(null);

  const { services, loading, refreshing, error, refresh } = useNearbyServices();

  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === 'profile')  router.replace(ROUTES.APP.PROFILE as any);
    if (route === 'bookings') router.replace(ROUTES.APP.BOOKINGS as any);
  }, []);

  // Map a NearbyPartner _id back to the full partner object for the sheet
  const handleCardPress = useCallback(
    (provider: Provider) => {
      const partner = services.find((s) => s._id === provider.id) ?? null;
      setSelectedPartner(partner);
    },
    [services]
  );

  const firstName = customer?.name?.split(' ')[0] ?? 'there';

  const addresses: Address[] = (customer?.addresses ?? []) as Address[];

  // Filter by search query (name or category)
  const filteredProviders = services
    .map(toProvider)
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {/* ── Green hero card: location header + greeting + search ── */}
        <View style={styles.heroCard}>
          <Header
            addresses={addresses}
            selectedIndex={selectedAddressIndex}
            onSelectAddress={setSelectedAddressIndex}
            onNotificationPress={() => console.log('Open notifications')}
          />

          <View style={styles.titleBlock}>
            <Text style={styles.titleGreeting}>Hello, {firstName} </Text>
            <Text style={styles.titleTagline}>From hassles to{'\n'}solutions in one tap.</Text>
          </View>

          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFilterPress={() => console.log('Open filters')}
          />
        </View>

        <PromoBanner
          offer={PROMO_OFFER}
          onBookPress={() => console.log('Book floor cleaning')}
        />

        {/* ── Nearby Services ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Nearby Services</Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.messageContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filteredProviders.length === 0 ? (
          <View style={styles.messageContainer}>
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? 'No services match your search.'
                : 'No service providers available nearby right now.'}
            </Text>
          </View>
        ) : (
          <ServiceGrid
            providers={filteredProviders}
            onCardPress={handleCardPress}
            onAddPress={handleCardPress}
          />
        )}
      </ScrollView>

      <BottomNav onNavigate={handleNavigate} />

      {/* Partner detail + booking sheet */}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  // ── Green hero card ──────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: spacing.lg,
    // subtle shadow for depth
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  titleBlock: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
  },
  titleGreeting: {
    fontFamily: 'Oswald_400Regular',
    fontSize: 19,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.4,
  },
  titleTagline: {
    fontFamily: 'Oswald_700Bold',
    fontSize: 28,
    color: colors.white,
    lineHeight: 36,
    letterSpacing: 0.2,
  },
  sectionTitle: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  loader: {
    marginTop: spacing.xl,
  },
  messageContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: {
    color: '#E53935',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
