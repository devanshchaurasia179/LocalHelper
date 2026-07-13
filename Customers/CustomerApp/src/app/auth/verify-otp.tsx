import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { Customer } from '@/providers/AuthProvider';

const OTP_LENGTH = 6;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { requestOtp, confirmOtp, status } = useAuth();
  const colors = useTheme();

  // Already logged in → go home
  if (status === 'authenticated') {
    return <Redirect href="/" />;
  }

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const otp = digits.join('');
  const isComplete = otp.length === OTP_LENGTH;

  const handleDigitChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Support pasting a full OTP
  const handlePaste = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (clean.length === OTP_LENGTH) {
      setDigits(clean.split(''));
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!isComplete) return;
    if (!phone) {
      setError('Phone number missing. Go back and try again.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const customer = await confirmOtp(phone, otp);
      router.replace(resolveNextRoute(customer) as any);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? 'Verification failed. Please try again.';
      setError(msg);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  /** After OTP verification, send customer to the right screen */
  function resolveNextRoute(customer: Customer): string {
    if (!customer.isOnboarded) return '/onboarding/profile';
    return '/';
  }

  const handleResend = async () => {
    if (!phone || countdown > 0) return;
    setResending(true);
    setError('');
    setDigits(Array(OTP_LENGTH).fill(''));

    try {
      await requestOtp(phone);
      setCountdown(30);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? 'Failed to resend OTP. Please try again.';
      setError(msg);
    } finally {
      setResending(false);
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
            {/* Back */}
            <TouchableOpacity onPress={() => router.back()} style={styles.back}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                ← Back
              </ThemedText>
            </TouchableOpacity>

            {/* Header */}
            <ThemedView style={styles.header}>
              <ThemedText type="title">Verify your number</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                Enter the 6-digit code sent to{' '}
                <ThemedText type="small" style={{ fontWeight: '600' }}>
                  {phone ?? '—'}
                </ThemedText>
              </ThemedText>
            </ThemedView>

            {/* OTP digit boxes */}
            <View style={styles.otpRow}>
              {digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  style={[
                    styles.digitBox,
                    {
                      color: colors.text,
                      borderColor: error
                        ? '#ef4444'
                        : d
                        ? '#3b82f6'
                        : colors.backgroundElement,
                      backgroundColor: colors.backgroundElement,
                    },
                  ]}
                  value={d}
                  onChangeText={(t) => {
                    if (t.length > 1) {
                      handlePaste(t);
                    } else {
                      handleDigitChange(t, i);
                    }
                  }}
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyPress(nativeEvent.key, i)
                  }
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  textAlign="center"
                  selectTextOnFocus
                  returnKeyType={i === OTP_LENGTH - 1 ? 'done' : 'next'}
                  onSubmitEditing={i === OTP_LENGTH - 1 ? handleVerify : undefined}
                  autoFocus={i === 0}
                />
              ))}
            </View>

            {!!error && (
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            )}

            {/* Verify button */}
            <TouchableOpacity
              style={[styles.button, { opacity: !isComplete || loading ? 0.5 : 1 }]}
              onPress={handleVerify}
              disabled={!isComplete || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Verify</ThemedText>
              )}
            </TouchableOpacity>

            {/* Resend */}
            <View style={styles.resendRow}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                Didn't receive it?{' '}
              </ThemedText>
              <TouchableOpacity
                onPress={handleResend}
                disabled={countdown > 0 || resending}
              >
                {resending ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <ThemedText
                    type="small"
                    style={{
                      color: countdown > 0 ? colors.textSecondary : '#3b82f6',
                      fontWeight: '600',
                    }}
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
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
  back: {
    position: 'absolute',
    top: Spacing.four,
    left: Spacing.four,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  otpRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  digitBox: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    fontSize: 22,
    fontWeight: '700',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: -Spacing.two,
  },
  button: {
    height: 52,
    borderRadius: Spacing.two,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
