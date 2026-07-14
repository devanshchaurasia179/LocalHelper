import { useState, useCallback } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import Header from './Header';
import SearchBar from './SearchBar';
import PromoBanner from './PromoBanner';
import ServiceGrid from './ServiceGrid';
import BottomNav from './BottomNav';

import { Provider, PromoOffer, NavRoute } from './types';
import { colors, spacing, typography } from './theme';
import { useAuth } from '@/providers/AuthProvider';
import { ROUTES } from '@/constants/routes';
import type { Address } from './Header';

// ─── Mock data. Replace with real API calls when ready. ──────────────────────

const PROMO_OFFER: PromoOffer = {
  discountPercent: 10,
  description: 'Discount for every cleaning order',
  serviceName: 'Floor Cleaning',
  servicePrice: 25,
  image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400',
};

const PROVIDERS: Provider[] = [
  {
    id: '1',
    name: 'Ryan Bergson',
    category: 'Desk Cleaning',
    pricePerHour: 35,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300',
  },
  {
    id: '2',
    name: 'Ryan Bergson',
    category: 'Floor Cleaning',
    pricePerHour: 35,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300',
  },
  {
    id: '3',
    name: 'Maria Lopez',
    category: 'Window Cleaning',
    pricePerHour: 28,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=300',
  },
  {
    id: '4',
    name: 'James Carter',
    category: 'Deep Cleaning',
    pricePerHour: 42,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300',
  },
];

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { customer } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);

  const handleNavigate = useCallback((route: NavRoute) => {
    if (route === 'profile') router.replace(ROUTES.APP.PROFILE as any);
  }, []);

  // Pull first name from the authenticated customer; fallback to 'there'
  const firstName = customer?.name?.split(' ')[0] ?? 'there';

  // Use customer's avatar initial as placeholder (no remote avatar stored)
  const avatarUri = `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.name ?? 'U')}&background=6C63FF&color=fff&size=200`;

  // Addresses from backend; cast to our Address type
  const addresses: Address[] = (customer?.addresses ?? []) as Address[];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Header
          avatarUri={avatarUri}
          addresses={addresses}
          selectedIndex={selectedAddressIndex}
          onSelectAddress={setSelectedAddressIndex}
          onNotificationPress={() => console.log('Open notifications')}
        />

        <Text style={[typography.heading, styles.title]}>
          Hello {firstName},{'\n'}from hassles to solution in one tap
        </Text>

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFilterPress={() => console.log('Open filters')}
        />

        <PromoBanner
          offer={PROMO_OFFER}
          onBookPress={() => console.log('Book floor cleaning')}
        />

        <ServiceGrid
          providers={PROVIDERS}
          onCardPress={(provider) => console.log('Open provider', provider.id)}
          onAddPress={(provider) => console.log('Add provider', provider.id)}
        />
      </ScrollView>

      <BottomNav onNavigate={handleNavigate} />
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
  title: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
});
