import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { submitKyc } from '@/constants/documents.api';

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * Onboarding Step 3 – KYC Documents
 * Fields: aadhaarNumber, panNumber
 * Note: aadhaarFront, aadhaarBack, panImage are image uploads — currently
 *       accepted as placeholder URL strings until image picker is wired up.
 * Calls PUT /api/partner/documents/kyc
 * On success → navigate to / (home)
 */
export default function OnboardingDocumentsScreen() {
  const router = useRouter();
  const { patchPartner } = useAuth();
  const colors = useTheme();

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Derived ──────────────────────────────────────────────────────────────
  // Aadhaar is required (12 digits), PAN is optional
  const isValid = aadhaarNumber.replace(/\s/g, '').length === 12;

  // ── Validation ────────────────────────────────────────────────────────────
  const validateFields = () => {
    const errs: Record<string, string> = {};
    const rawAadhaar = aadhaarNumber.replace(/\s/g, '');

    if (!/^\d{12}$/.test(rawAadhaar)) {
      errs.aadhaar = 'Aadhaar must be exactly 12 digits.';
    }

    if (panNumber.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.trim().toUpperCase())) {
      errs.pan = 'Invalid PAN. Format: ABCDE1234F';
    }

    return errs;
  };

  // ── Aadhaar auto-format: 4-4-4 grouping ──────────────────────────────────
  const handleAadhaarChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 12);
    const formatted = digits
      .match(/.{1,4}/g)
      ?.join(' ') ?? digits;
    setAadhaarNumber(formatted);
    if (fieldErrors.aadhaar) setFieldErrors((p) => ({ ...p, aadhaar: '' }));
    setError('');
  };

  // ── PAN auto-uppercase ────────────────────────────────────────────────────
  const handlePanChange = (v: string) => {
    setPanNumber(v.toUpperCase().slice(0, 10));
    if (fieldErrors.pan) setFieldErrors((p) => ({ ...p, pan: '' }));
    setError('');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validateFields();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setError('');
    setLoading(true);

    try {
      await submitKyc({
        aadhaarNumber: aadhaarNumber.replace(/\s/g, ''),
        panNumber: panNumber.trim() || undefined as any,
      });
      patchPartner({ isDocument: true });
      router.replace('/');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Input style ──────────────────────────────────────────────────────────
  const inputStyle = (hasError = false) => ({
    color: colors.text,
    borderColor: hasError ? '#ef4444' : colors.backgroundElement,
    backgroundColor: colors.backgroundElement,
  });

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>

              {/* ── Header ── */}
              <View style={styles.header}>
                <ThemedText type="title">KYC Verification</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Step 3 of 3 — Your documents are kept safe and encrypted.
                </ThemedText>
              </View>

              {/* ── Info Banner ── */}
              <View style={[styles.infoBanner, { backgroundColor: colors.backgroundElement }]}>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  ℹ️  Your details are used only for identity verification and will not be shared with anyone.
                </ThemedText>
              </View>

              {/* ── Aadhaar Number ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">Aadhaar Number *</ThemedText>
                <TextInput
                  style={[styles.input, inputStyle(!!fieldErrors.aadhaar)]}
                  placeholder="XXXX XXXX XXXX"
                  placeholderTextColor={colors.textSecondary}
                  value={aadhaarNumber}
                  onChangeText={handleAadhaarChange}
                  keyboardType="number-pad"
                  maxLength={14} // 12 digits + 2 spaces
                  textContentType="none"
                />
                {!!fieldErrors.aadhaar && (
                  <ThemedText type="small" style={styles.fieldError}>
                    {fieldErrors.aadhaar}
                  </ThemedText>
                )}
              </View>

              {/* ── PAN Number ── */}
              <View style={styles.field}>
                <ThemedText type="smallBold">PAN Number</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Optional — required for income tax purposes
                </ThemedText>
                <TextInput
                  style={[styles.input, inputStyle(!!fieldErrors.pan)]}
                  placeholder="ABCDE1234F"
                  placeholderTextColor={colors.textSecondary}
                  value={panNumber}
                  onChangeText={handlePanChange}
                  autoCapitalize="characters"
                  maxLength={10}
                  textContentType="none"
                />
                {!!fieldErrors.pan && (
                  <ThemedText type="small" style={styles.fieldError}>
                    {fieldErrors.pan}
                  </ThemedText>
                )}
              </View>

              {/* ── Document Images note ── */}
              <View style={[styles.infoBanner, { backgroundColor: colors.backgroundElement }]}>
                <ThemedText type="smallBold" style={{ marginBottom: 4 }}>
                  📎 Document Images
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Aadhaar front/back and PAN card images will be required in a later step.
                  For now, submitting your numbers is enough to proceed.
                </ThemedText>
              </View>

              {/* ── Error ── */}
              {!!error && (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              )}

              {/* ── Submit ── */}
              <TouchableOpacity
                style={[styles.button, { opacity: !isValid || loading ? 0.5 : 1 }]}
                onPress={handleSubmit}
                disabled={!isValid || loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.buttonText}>Submit & Continue →</ThemedText>
                )}
              </TouchableOpacity>

              {/* ── Terms note ── */}
              <ThemedText
                type="small"
                style={[styles.terms, { color: colors.textSecondary }]}
              >
                By submitting, you confirm these details are accurate and consent to identity verification.
              </ThemedText>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  kav: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  content: { gap: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  field: { gap: Spacing.two },
  infoBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  input: {
    height: 52,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    letterSpacing: 1.5,
  },
  fieldError: {
    color: '#ef4444',
    marginTop: -Spacing.one,
  },
  errorText: {
    color: '#ef4444',
    marginTop: -Spacing.one,
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
  terms: {
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -Spacing.one,
  },
});
