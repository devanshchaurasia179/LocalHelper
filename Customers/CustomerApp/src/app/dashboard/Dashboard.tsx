/**
 * Dashboard.tsx — main Cleaning Services dashboard screen.
 *
 * Composes: Header · SearchBar · PromoBanner · ServiceGrid · BottomNav
 * All mock data lives here so it's easy to swap for real API data later.
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { PromoBanner } from './components/PromoBanner';
import { ServiceGrid } from './components/ServiceGrid';
import { BottomNav } from './components/BottomNav';

import { DashColors, DashSpacing, NAV_INSET } from './theme';
import { ServiceProvider, NavItem, PromoInfo } from './types';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_USER = {
  name: 'Priya Sharma',
  avatarUri: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&q=80',
};

const MOCK_PROMO: PromoInfo = {
  headline: 'Professional Home\nCleaning',
  subline: 'First booking discount — limited slots!',
  discountLabel: '30%',
  gradient: ['#7C3AED', '#4F46E5'],
};

const MOCK_PROVIDERS: ServiceProvider[] = [
  {
    id: '1',
    name: 'Sunita Devi',
    category: 'Deep Cleaning',
    imageUrl: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=400&q=80',
    rating: 4.8,
    reviewCount: 142,
    pricePerHour: 299,
    isFavourite: true,
  },
  {
    id: '2',
    name: 'Rajan Cleaners',
    category: 'Regular Cleaning',
    imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80',
    rating: 4.5,
    reviewCount: 98,
    pricePerHour: 199,
    isFavourite: false,
  },
  {
    id: '3',
    name: 'Meena Services',
    category: 'Kitchen Cleaning',
    imageUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&q=80',
    rating: 4.9,
    reviewCount: 201,
    pricePerHour: 349,
    isFavourite: false,
  },
  {
    id: '4',
    name: 'SparkleHome',
    category: 'Bathroom Cleaning',
    imageUrl: 'https://images.unsplash.com/photo-1527515637462-cff94aca208e?w=400&q=80',
    rating: 4.6,
    reviewCount: 77,
    pricePerHour: 249,
    isFavourite: true,
  },
  {
    id: '5',
    name: 'QuickMop Pro',
    category: 'Floor Polishing',
    imageUrl: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&q=80',
    rating: 4.3,
    reviewCount: 54,
    pricePerHour: 179,
    isFavourite: false,
  },
  {
    id: '6',
    name: 'Fresh Space Co.',
    category: 'Move-in Cleaning',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    rating: 4.7,
    reviewCount: 133,
    pricePerHour: 399,
    isFavourite: false,
  },
];

const NAV_ITEMS: NavItem[] = [
  { key: 'home',     label: 'Home',     icon: 'home-outline',          iconActive: 'home' },
  { key: 'bookings', label: 'Bookings', icon: 'calendar-outline',      iconActive: 'calendar' },
  { key: 'search',   label: 'Explore',  icon: 'compass-outline',       iconActive: 'compass' },
  { key: 'profile',  label: 'Profile',  icon: 'person-circle-outline', iconActive: 'person-circle' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState('home');
  const [providers, setProviders] = useState<ServiceProvider[]>(MOCK_PROVIDERS);

  // Filter providers by search query
  const filtered = searchQuery.trim()
    ? providers.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : providers;

  function toggleFavourite(provider: ServiceProvider) {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === provider.id ? { ...p, isFavourite: !p.isFavourite } : p,
      ),
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={DashColors.background} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Scrollable content ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Header
            userName={MOCK_USER.name}
            avatarUri={MOCK_USER.avatarUri}
            notificationCount={3}
            onNotificationPress={() => console.log('notifications')}
            onAvatarPress={() => console.log('avatar')}
          />

          {/* Search */}
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search cleaning services..."
            onFilterPress={() => console.log('filter')}
          />

          {/* Promo banner — hidden when user is actively searching */}
          {!searchQuery.trim() && (
            <PromoBanner
              promo={MOCK_PROMO}
              onPress={() => console.log('promo')}
            />
          )}

          {/* Service grid */}
          <ServiceGrid
            providers={filtered}
            sectionTitle={searchQuery.trim() ? `Results for "${searchQuery}"` : 'Nearby Services'}
            onAddPress={(p) => console.log('add', p.name)}
            onFavouritePress={toggleFavourite}
            onCardPress={(p) => console.log('card', p.name)}
          />
        </ScrollView>
      </SafeAreaView>

      {/* Floating bottom nav — outside ScrollView so it overlays content */}
      <BottomNav
        items={NAV_ITEMS}
        activeKey={activeNav}
        onPress={setActiveNav}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DashColors.background,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: DashSpacing.base,
    paddingTop: DashSpacing.md,
    paddingBottom: NAV_INSET,
    gap: DashSpacing.lg,
  },
});
