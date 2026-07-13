import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthGate } from '@/providers/AuthGate';
import { useAuth } from '@/providers/AuthProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing, BottomTabInset } from '@/constants/theme';

// ─── Home content (shown only when fully onboarded) ──────────────────────────

function HomeContent() {
  const { partner } = useAuth();
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText type="title" style={styles.title}>
            Welcome back, {partner?.fullName ?? partner?.phone} 👋
          </ThemedText>
          <ThemedText type="small" style={styles.subtitle}>
            {partner?.phone}
          </ThemedText>
        </ThemedView>

        <TouchableOpacity
          style={styles.bookingsButton}
          onPress={() => router.push('/bookings' as any)}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.bookingsButtonText}>📋 My Bookings</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Root entry point ────────────────────────────────────────────────────────

export default function IndexScreen() {
  const { status } = useAuth();

  // Still restoring session from cookie
  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Not logged in → go to OTP login
  if (status === 'unauthenticated') {
    return <Redirect href="/auth/send-otp" />;
  }

  // Authenticated → AuthGate handles onboarding redirects, then shows home
  return (
    <AuthGate>
      <HomeContent />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  bookingsButton: {
    height: 52,
    borderRadius: Spacing.two,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  bookingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
