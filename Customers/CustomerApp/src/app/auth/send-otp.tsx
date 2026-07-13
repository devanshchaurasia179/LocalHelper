import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function SendOtpScreen() {
  const router = useRouter();
  const { requestOtp, status } = useAuth();

  // Already logged in → go home, don't show login screen
  if (status === 'authenticated') {
    return <Redirect href="/" />;
  }
  const colors = useTheme();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidPhone = phone.trim().length >= 7;

  const handleSend = async () => {
    if (!isValidPhone) {
      setError('Please enter a valid phone number.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await requestOtp(phone.trim());
      router.push({ pathname: '/auth/verify-otp', params: { phone: phone.trim() } });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? 'Failed to send OTP. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.inner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ThemedView style={styles.content}>
            {/* Header */}
            <ThemedView style={styles.header}>
              <ThemedText type="title">Enter your phone</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                We'll send a one-time code to verify your number.
              </ThemedText>
            </ThemedView>

            {/* Input */}
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: error ? '#ef4444' : colors.backgroundElement,
                  backgroundColor: colors.backgroundElement,
                },
              ]}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                if (error) setError('');
              }}
              returnKeyType="done"
              onSubmitEditing={handleSend}
              autoFocus
            />

            {!!error && (
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            )}

            {/* Button */}
            <TouchableOpacity
              style={[styles.button, { opacity: !isValidPhone || loading ? 0.5 : 1 }]}
              onPress={handleSend}
              disabled={!isValidPhone || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Send OTP</ThemedText>
              )}
            </TouchableOpacity>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  input: {
    height: 52,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    marginTop: -Spacing.two,
  },
  button: {
    height: 52,
    borderRadius: Spacing.two,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
