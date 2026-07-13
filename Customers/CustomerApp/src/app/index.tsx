import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import Dashboard from './dashboard/Dashboard';

// ─── Root entry point ─────────────────────────────────────────────────────────

export default function IndexScreen() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/auth/send-otp" />;
  }

  // AuthGate in _layout.tsx already handles onboarding redirects
  return <Dashboard />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
