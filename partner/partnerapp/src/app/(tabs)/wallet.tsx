import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radii } from "@/constants/theme";
import BottomNav from "@/components/navigation/BottomNav";
import {
  useWalletSummary,
  useTransactions,
  useTransactionAccount,
  useRequestPayout,
  useSaveBankAccount,
  useSaveUpiId,
  useSetPreferredMethod,
  useDeleteBankAccount,
  useDeleteUpiId,
} from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";
import {
  WALLET_SUMMARY_KEY,
  TRANSACTIONS_KEY,
  TRANSACTION_ACCOUNT_KEY,
} from "@/hooks/useWallet";
import type { Transaction, TransactionType } from "@/api/wallet.api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.direction === "credit";

  const iconName =
    tx.type === "earning"
      ? "arrow-down-circle"
      : tx.type === "payout"
      ? "arrow-up-circle"
      : "swap-horizontal";

  const iconColor =
    tx.type === "earning"
      ? colors.success
      : tx.type === "payout"
      ? colors.error
      : colors.primary;

  const statusColor: Record<string, string> = {
    completed:  colors.success,
    pending:    "#F59E0B",
    processing: "#3B82F6",
    failed:     colors.error,
  };

  const typeLabel =
    tx.type === "earning" ? "Earning" : tx.type === "payout" ? "Payout" : "Adjustment";

  return (
    <View style={txStyles.row}>
      <View style={[txStyles.iconWrap, { backgroundColor: isCredit ? "#ECFDF5" : "#FEF2F2" }]}>
        <Ionicons name={iconName as any} size={22} color={iconColor} />
      </View>
      <View style={txStyles.info}>
        <Text style={txStyles.typeLabel} numberOfLines={1}>
          {tx.description || typeLabel}
        </Text>
        <Text style={txStyles.date}>
          {formatDate(tx.createdAt)} · {formatTime(tx.createdAt)}
        </Text>
        {tx.type === "payout" && (
          <View style={[txStyles.statusBadge, { backgroundColor: statusColor[tx.status] + "22" }]}>
            <View style={[txStyles.statusDot, { backgroundColor: statusColor[tx.status] }]} />
            <Text style={[txStyles.statusText, { color: statusColor[tx.status] }]}>
              {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
            </Text>
          </View>
        )}
      </View>
      <View style={txStyles.amountWrap}>
        <Text style={[txStyles.amount, { color: isCredit ? colors.success : colors.error }]}>
          {isCredit ? "+" : "−"}{formatCurrency(tx.amount)}
        </Text>
        <Text style={txStyles.balanceAfter}>Bal: {formatCurrency(tx.balanceAfter)}</Text>
      </View>
    </View>
  );
}

const txStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  typeLabel: {
    fontFamily: fonts.jostMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  date: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 3,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
  },
  amountWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    fontFamily: fonts.oswaldSemiBold,
    fontSize: 15,
  },
  balanceAfter: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
});

// ─── Bank Account Form Modal ──────────────────────────────────────────────────

interface BankFormModalProps {
  visible: boolean;
  onClose: () => void;
  initialValues?: {
    accountHolderName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    bankName?: string | null;
    branchName?: string | null;
  } | null;
}

function BankFormModal({ visible, onClose, initialValues }: BankFormModalProps) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  const [holderName, setHolderName] = useState("");
  const [accNumber, setAccNumber]   = useState("");
  const [ifsc, setIfsc]             = useState("");
  const [bankName, setBankName]     = useState("");
  const [branch, setBranch]         = useState("");
  const [error, setError]           = useState<string | null>(null);

  const { mutate: save, isPending } = useSaveBankAccount();

  useEffect(() => {
    if (visible) {
      setHolderName(initialValues?.accountHolderName ?? "");
      setAccNumber(initialValues?.accountNumber ?? "");
      setIfsc(initialValues?.ifscCode ?? "");
      setBankName(initialValues?.bankName ?? "");
      setBranch(initialValues?.branchName ?? "");
      setError(null);
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    setError(null);
    if (!holderName.trim() || !accNumber.trim() || !ifsc.trim() || !bankName.trim()) {
      setError("Account holder name, account number, IFSC, and bank name are required.");
      return;
    }
    save(
      {
        accountHolderName: holderName.trim(),
        accountNumber: accNumber.trim(),
        ifscCode: ifsc.trim().toUpperCase(),
        bankName: bankName.trim(),
        branchName: branch.trim() || undefined,
      },
      {
        onSuccess: () => onClose(),
        onError: (e: any) => {
          const msg = e?.response?.data?.message ?? "Failed to save bank account.";
          setError(msg);
        },
      }
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={formModalStyles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View style={[StyleSheet.absoluteFill, formModalStyles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={!isPending ? onClose : undefined} />
        </Animated.View>
        <Animated.View style={[formModalStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={formModalStyles.handle} />
          <View style={formModalStyles.headerRow}>
            <View style={formModalStyles.iconWrap}>
              <Ionicons name="card" size={22} color={colors.primary} />
            </View>
            <Text style={formModalStyles.sheetTitle}>Bank Account</Text>
          </View>
          <Text style={formModalStyles.sheetSubtitle}>
            Your earnings will be transferred to this account.
          </Text>

          {error && (
            <View style={formModalStyles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={formModalStyles.errorText}>{error}</Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} style={{ width: "100%" }}>
            <Text style={formModalStyles.label}>Account Holder Name *</Text>
            <TextInput
              style={formModalStyles.input}
              placeholder="e.g. Ravi Kumar"
              placeholderTextColor={colors.textSecondary}
              value={holderName}
              onChangeText={setHolderName}
              autoCapitalize="words"
            />
            <Text style={formModalStyles.label}>Account Number *</Text>
            <TextInput
              style={formModalStyles.input}
              placeholder="9–18 digit account number"
              placeholderTextColor={colors.textSecondary}
              value={accNumber}
              onChangeText={setAccNumber}
              keyboardType="number-pad"
            />
            <Text style={formModalStyles.label}>IFSC Code *</Text>
            <TextInput
              style={formModalStyles.input}
              placeholder="e.g. SBIN0001234"
              placeholderTextColor={colors.textSecondary}
              value={ifsc}
              onChangeText={(v) => setIfsc(v.toUpperCase())}
              autoCapitalize="characters"
            />
            <Text style={formModalStyles.label}>Bank Name *</Text>
            <TextInput
              style={formModalStyles.input}
              placeholder="e.g. State Bank of India"
              placeholderTextColor={colors.textSecondary}
              value={bankName}
              onChangeText={setBankName}
              autoCapitalize="words"
            />
            <Text style={formModalStyles.label}>Branch Name (Optional)</Text>
            <TextInput
              style={formModalStyles.input}
              placeholder="e.g. MG Road"
              placeholderTextColor={colors.textSecondary}
              value={branch}
              onChangeText={setBranch}
              autoCapitalize="words"
            />
          </ScrollView>

          <View style={formModalStyles.actions}>
            <Pressable style={formModalStyles.saveBtn} onPress={handleSave} disabled={isPending}>
              {isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={17} color={colors.white} />
                  <Text style={formModalStyles.saveBtnText}>Save Bank Account</Text>
                </>
              )}
            </Pressable>
            <Pressable style={formModalStyles.cancelBtn} onPress={onClose} disabled={isPending}>
              <Text style={formModalStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── UPI Form Modal ───────────────────────────────────────────────────────────

interface UpiFormModalProps {
  visible: boolean;
  onClose: () => void;
  initialUpiId?: string | null;
}

function UpiFormModal({ visible, onClose, initialUpiId }: UpiFormModalProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const [upiId, setUpiId]   = useState("");
  const [error, setError]   = useState<string | null>(null);

  const { mutate: save, isPending } = useSaveUpiId();

  useEffect(() => {
    if (visible) {
      setUpiId(initialUpiId ?? "");
      setError(null);
      slideAnim.setValue(300);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    setError(null);
    if (!upiId.trim()) {
      setError("UPI ID is required.");
      return;
    }
    save(upiId.trim(), {
      onSuccess: () => onClose(),
      onError: (e: any) => {
        const msg = e?.response?.data?.message ?? "Failed to save UPI ID.";
        setError(msg);
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={formModalStyles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View style={[StyleSheet.absoluteFill, formModalStyles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={!isPending ? onClose : undefined} />
        </Animated.View>
        <Animated.View style={[formModalStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={formModalStyles.handle} />
          <View style={formModalStyles.headerRow}>
            <View style={[formModalStyles.iconWrap, { backgroundColor: "#F0FDF4" }]}>
              <Ionicons name="phone-portrait" size={22} color={colors.primary} />
            </View>
            <Text style={formModalStyles.sheetTitle}>UPI ID</Text>
          </View>
          <Text style={formModalStyles.sheetSubtitle}>
            Instant payouts will be sent to this UPI address.
          </Text>

          {error && (
            <View style={formModalStyles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={formModalStyles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={formModalStyles.label}>UPI ID *</Text>
          <TextInput
            style={formModalStyles.input}
            placeholder="e.g. 9876543210@upi"
            placeholderTextColor={colors.textSecondary}
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View style={formModalStyles.actions}>
            <Pressable style={formModalStyles.saveBtn} onPress={handleSave} disabled={isPending}>
              {isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={17} color={colors.white} />
                  <Text style={formModalStyles.saveBtnText}>Save UPI ID</Text>
                </>
              )}
            </Pressable>
            <Pressable style={formModalStyles.cancelBtn} onPress={onClose} disabled={isPending}>
              <Text style={formModalStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Payout Request Modal ─────────────────────────────────────────────────────

interface PayoutModalProps {
  visible: boolean;
  onClose: () => void;
  availableBalance: number;
  preferredMethod: "bank" | "upi" | null;
}

function PayoutModal({ visible, onClose, availableBalance, preferredMethod }: PayoutModalProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale   = useRef(new Animated.Value(0.7)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const [amount, setAmount]       = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const { mutate: payout, isPending } = useRequestPayout();

  useEffect(() => {
    if (visible) {
      setAmount("");
      setError(null);
      setSucceeded(false);
      slideAnim.setValue(300);
      fadeAnim.setValue(0);
      successScale.setValue(0.7);
      successOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const handleRequest = () => {
    setError(null);
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) {
      setError("Enter a valid amount.");
      triggerShake();
      return;
    }
    if (val > availableBalance) {
      setError(`Amount exceeds available balance of ${formatCurrency(availableBalance)}.`);
      triggerShake();
      return;
    }
    if (!preferredMethod) {
      setError("Set up your bank account or UPI before requesting a payout.");
      return;
    }
    payout(val, {
      onSuccess: () => {
        setSucceeded(true);
        Animated.parallel([
          Animated.spring(successScale,   { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 120 }),
          Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start(() => setTimeout(onClose, 1600));
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.message ?? "Payout request failed. Try again.";
        setError(msg);
        triggerShake();
      },
    });
  };

  const methodLabel = preferredMethod === "bank" ? "Bank Transfer" : preferredMethod === "upi" ? "UPI" : "—";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={formModalStyles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View style={[StyleSheet.absoluteFill, formModalStyles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={!isPending && !succeeded ? onClose : undefined} />
        </Animated.View>
        <Animated.View style={[formModalStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Success overlay */}
          {succeeded && (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, formModalStyles.successOverlay, { opacity: successOpacity }]}
            >
              <Animated.View style={{ transform: [{ scale: successScale }], alignItems: "center" }}>
                <View style={formModalStyles.successIconWrap}>
                  <Ionicons name="checkmark-circle" size={72} color={colors.success} />
                </View>
                <Text style={formModalStyles.successTitle}>Payout Requested!</Text>
                <Text style={formModalStyles.successSub}>
                  Processed within 2–3 business days.
                </Text>
              </Animated.View>
            </Animated.View>
          )}

          <View style={formModalStyles.handle} />
          <View style={formModalStyles.headerRow}>
            <View style={[formModalStyles.iconWrap, { backgroundColor: "#ECFDF5" }]}>
              <Ionicons name="send" size={22} color={colors.primary} />
            </View>
            <Text style={formModalStyles.sheetTitle}>Request Payout</Text>
          </View>

          {/* Available balance display */}
          <View style={payoutStyles.balanceRow}>
            <Text style={payoutStyles.balanceLabel}>Available Balance</Text>
            <Text style={payoutStyles.balanceValue}>{formatCurrency(availableBalance)}</Text>
          </View>
          <View style={payoutStyles.methodRow}>
            <Ionicons
              name={preferredMethod === "upi" ? "phone-portrait" : "card"}
              size={14}
              color={colors.textSecondary}
            />
            <Text style={payoutStyles.methodText}>via {methodLabel}</Text>
          </View>

          {error && (
            <Animated.View
              style={[formModalStyles.errorBox, { transform: [{ translateX: shakeAnim }] }]}
            >
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={formModalStyles.errorText}>{error}</Text>
            </Animated.View>
          )}

          <Text style={formModalStyles.label}>Amount (₹) *</Text>
          <Animated.View style={{ transform: [{ translateX: shakeAnim }], width: "100%" }}>
            <TextInput
              style={[formModalStyles.input, payoutStyles.amountInput]}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              value={amount}
              onChangeText={(v) => { setAmount(v); setError(null); }}
              keyboardType="decimal-pad"
            />
          </Animated.View>

          <Pressable
            style={payoutStyles.maxBtn}
            onPress={() => setAmount(availableBalance.toFixed(2))}
          >
            <Text style={payoutStyles.maxBtnText}>Use Max ({formatCurrency(availableBalance)})</Text>
          </Pressable>

          <View style={formModalStyles.actions}>
            <Pressable
              style={[formModalStyles.saveBtn, availableBalance <= 0 && { opacity: 0.5 }]}
              onPress={handleRequest}
              disabled={isPending || availableBalance <= 0}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="send" size={17} color={colors.white} />
                  <Text style={formModalStyles.saveBtnText}>Request Payout</Text>
                </>
              )}
            </Pressable>
            <Pressable style={formModalStyles.cancelBtn} onPress={onClose} disabled={isPending}>
              <Text style={formModalStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const payoutStyles = StyleSheet.create({
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    width: "100%",
    marginBottom: spacing.xs,
  },
  balanceLabel: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  balanceValue: {
    fontFamily: fonts.oswaldBold,
    fontSize: 20,
    color: colors.primary,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: spacing.md,
  },
  methodText: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  amountInput: {
    fontFamily: fonts.oswaldBold,
    fontSize: 22,
    textAlign: "center",
    letterSpacing: 1,
  },
  maxBtn: {
    alignSelf: "center",
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  maxBtnText: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: colors.primary,
    textDecorationLine: "underline",
  },
});

// ─── Shared Modal Styles ──────────────────────────────────────────────────────

const formModalStyles = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: "flex-end" },
  backdrop:  { backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    paddingTop: spacing.sm,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 24,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontFamily: fonts.oswaldBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    alignSelf: "flex-start",
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.errorLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: "100%",
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errorText: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.error,
    flex: 1,
  },
  label: {
    fontFamily: fonts.jostMedium,
    fontSize: 13,
    color: colors.textPrimary,
    alignSelf: "flex-start",
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    width: "100%",
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  saveBtnText: {
    fontFamily: fonts.oswaldSemiBold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
  },
  cancelBtnText: {
    fontFamily: fonts.jostMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  successOverlay: {
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  successIconWrap: {
    marginBottom: spacing.md,
  },
  successTitle: {
    fontFamily: fonts.oswaldBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  successSub: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});

// ─── Filter Pill ──────────────────────────────────────────────────────────────

const FILTERS: { label: string; value: TransactionType | "all" }[] = [
  { label: "All",         value: "all" },
  { label: "Earnings",    value: "earning" },
  { label: "Payouts",     value: "payout" },
  { label: "Adjustments", value: "adjustment" },
];

// ─── Main Wallet Screen ───────────────────────────────────────────────────────

export default function WalletScreen() {
  const queryClient = useQueryClient();

  const [filter, setFilter]             = useState<TransactionType | "all">("all");
  const [refreshing, setRefreshing]     = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showUpiModal, setShowUpiModal]   = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const { mutate: setPreferred }    = useSetPreferredMethod();
  const { mutate: delBank, isPending: deletingBank } = useDeleteBankAccount();
  const { mutate: delUpi,  isPending: deletingUpi  } = useDeleteUpiId();

  const queryParams = filter === "all" ? {} : { type: filter as TransactionType };

  const { data: summary, isLoading: summaryLoading }     = useWalletSummary();
  const { data: txData,  isLoading: txLoading, refetch: refetchTx } = useTransactions(queryParams);
  const { data: account, isLoading: accountLoading }     = useTransactionAccount();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: WALLET_SUMMARY_KEY }),
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY }),
      queryClient.invalidateQueries({ queryKey: TRANSACTION_ACCOUNT_KEY }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const hasBankAccount = !!(account?.bankAccount?.accountNumber);
  const hasUpi         = !!(account?.upiId);
  const preferredMethod = account?.preferredMethod ?? null;

  const handleDeleteBank = () => {
    Alert.alert(
      "Remove Bank Account",
      "Are you sure you want to remove your bank account details?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => delBank(undefined, {
            onError: (e: any) => Alert.alert("Error", e?.response?.data?.message ?? "Failed to remove bank account."),
          }),
        },
      ]
    );
  };

  const handleDeleteUpi = () => {
    Alert.alert(
      "Remove UPI ID",
      "Are you sure you want to remove your UPI ID?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => delUpi(undefined, {
            onError: (e: any) => Alert.alert("Error", e?.response?.data?.message ?? "Failed to remove UPI ID."),
          }),
        },
      ]
    );
  };

  const handleSetPreferred = (method: "bank" | "upi") => {
    if (method === preferredMethod) return;
    setPreferred(method, {
      onError: (e: any) => Alert.alert("Error", e?.response?.data?.message ?? "Failed to update preferred method."),
    });
  };

  // ── Masked account number ──
  const maskedAccount = account?.bankAccount?.accountNumber
    ? `•••• ${account.bankAccount.accountNumber.slice(-4)}`
    : null;

  const transactions = txData?.transactions ?? [];
  const isLoading    = summaryLoading || accountLoading;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Page Header ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Wallet</Text>
          <Ionicons name="wallet" size={24} color={colors.primary} />
        </View>

        {/* ── Wallet Summary Card ── */}
        {summaryLoading ? (
          <View style={[styles.summaryCard, styles.summaryCardSkeleton]}>
            <ActivityIndicator color={colors.white} size="large" />
          </View>
        ) : (
          <View style={styles.summaryCard}>
            {/* Top row: label + verified badge */}
            <View style={styles.summaryTopRow}>
              <Text style={styles.summaryLabel}>Available Balance</Text>
              {account?.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>

            {/* Big balance */}
            <Text style={styles.summaryBalance}>
              {summary ? formatCurrency(summary.availableBalance) : "—"}
            </Text>

            {/* Stats row */}
            <View style={styles.summaryStatsRow}>
              <View style={styles.statChip}>
                <Ionicons name="trending-up" size={13} color="#A7F3D0" />
                <View>
                  <Text style={styles.statChipLabel}>Total Earned</Text>
                  <Text style={styles.statChipValue}>
                    {summary ? formatCurrency(summary.totalEarnings) : "—"}
                  </Text>
                </View>
              </View>
              {(summary?.pendingPayout ?? 0) > 0 && (
                <View style={[styles.statChip, styles.statChipWarn]}>
                  <Ionicons name="time" size={13} color="#FDE68A" />
                  <View>
                    <Text style={[styles.statChipLabel, { color: "#FDE68A" }]}>In Transit</Text>
                    <Text style={[styles.statChipValue, { color: "#FDE68A" }]}>
                      {formatCurrency(summary!.pendingPayout)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Request Payout button */}
            <Pressable
              style={[
                styles.payoutBtn,
                (!preferredMethod || (summary?.availableBalance ?? 0) <= 0) && styles.payoutBtnDisabled,
              ]}
              onPress={() => setShowPayoutModal(true)}
              disabled={!preferredMethod || (summary?.availableBalance ?? 0) <= 0}
            >
              <Ionicons name="send" size={15} color={preferredMethod && (summary?.availableBalance ?? 0) > 0 ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.payoutBtnText,
                (!preferredMethod || (summary?.availableBalance ?? 0) <= 0) && styles.payoutBtnTextDisabled,
              ]}>
                {!preferredMethod
                  ? "Set up payout details first"
                  : (summary?.availableBalance ?? 0) <= 0
                  ? "No balance to withdraw"
                  : "Request Payout"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Payout Account Card ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payout Account</Text>
          <Text style={styles.sectionSubtitle}>
            Your earnings will be transferred to the preferred method below.
          </Text>

          {accountLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : (
            <>
              {/* Bank Account row */}
              <View style={styles.payoutRow}>
                <View style={styles.payoutRowLeft}>
                  <View style={[styles.payoutMethodIcon, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons name="card" size={18} color="#6366F1" />
                  </View>
                  <View style={styles.payoutMethodInfo}>
                    <Text style={styles.payoutMethodTitle}>Bank Account</Text>
                    {hasBankAccount ? (
                      <>
                        <Text style={styles.payoutMethodDetail}>
                          {account?.bankAccount?.bankName} · {maskedAccount}
                        </Text>
                        <Text style={styles.payoutMethodDetail2}>
                          {account?.bankAccount?.accountHolderName}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.payoutMethodEmpty}>Not set up</Text>
                    )}
                  </View>
                </View>
                <View style={styles.payoutRowActions}>
                  {hasBankAccount && (
                    <Pressable
                      style={styles.preferredBtn}
                      onPress={() => handleSetPreferred("bank")}
                    >
                      <Ionicons
                        name={preferredMethod === "bank" ? "star" : "star-outline"}
                        size={18}
                        color={preferredMethod === "bank" ? colors.star : colors.textSecondary}
                      />
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.editIconBtn}
                    onPress={() => setShowBankModal(true)}
                  >
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                  </Pressable>
                  {hasBankAccount && (
                    <Pressable
                      style={[styles.editIconBtn, { backgroundColor: colors.errorLight }]}
                      onPress={handleDeleteBank}
                      disabled={deletingBank}
                    >
                      {deletingBank
                        ? <ActivityIndicator size="small" color={colors.error} />
                        : <Ionicons name="trash" size={16} color={colors.error} />
                      }
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              {/* UPI row */}
              <View style={styles.payoutRow}>
                <View style={styles.payoutRowLeft}>
                  <View style={[styles.payoutMethodIcon, { backgroundColor: "#F0FDF4" }]}>
                    <Ionicons name="phone-portrait" size={18} color={colors.success} />
                  </View>
                  <View style={styles.payoutMethodInfo}>
                    <Text style={styles.payoutMethodTitle}>UPI</Text>
                    {hasUpi ? (
                      <Text style={styles.payoutMethodDetail}>{account?.upiId}</Text>
                    ) : (
                      <Text style={styles.payoutMethodEmpty}>Not set up</Text>
                    )}
                  </View>
                </View>
                <View style={styles.payoutRowActions}>
                  {hasUpi && (
                    <Pressable
                      style={styles.preferredBtn}
                      onPress={() => handleSetPreferred("upi")}
                    >
                      <Ionicons
                        name={preferredMethod === "upi" ? "star" : "star-outline"}
                        size={18}
                        color={preferredMethod === "upi" ? colors.star : colors.textSecondary}
                      />
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.editIconBtn}
                    onPress={() => setShowUpiModal(true)}
                  >
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                  </Pressable>
                  {hasUpi && (
                    <Pressable
                      style={[styles.editIconBtn, { backgroundColor: colors.errorLight }]}
                      onPress={handleDeleteUpi}
                      disabled={deletingUpi}
                    >
                      {deletingUpi
                        ? <ActivityIndicator size="small" color={colors.error} />
                        : <Ionicons name="trash" size={16} color={colors.error} />
                      }
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Preferred method label */}
              {preferredMethod && (
                <View style={styles.preferredNote}>
                  <Ionicons name="information-circle" size={13} color={colors.textSecondary} />
                  <Text style={styles.preferredNoteText}>
                    Tap ⭐ to set your preferred payout method. Currently:{" "}
                    <Text style={{ color: colors.primary }}>
                      {preferredMethod === "bank" ? "Bank Account" : "UPI"}
                    </Text>
                  </Text>
                </View>
              )}

              {!hasBankAccount && !hasUpi && (
                <View style={styles.noAccountNote}>
                  <Ionicons name="warning" size={14} color="#F59E0B" />
                  <Text style={styles.noAccountText}>
                    Add a bank account or UPI ID to request payouts.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── Transaction History ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Transaction History</Text>

          {/* Filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            {FILTERS.map((f) => (
              <Pressable
                key={f.value}
                style={[styles.filterPill, filter === f.value && styles.filterPillActive]}
                onPress={() => setFilter(f.value)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filter === f.value && styles.filterPillTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* List */}
          {txLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={colors.navInactive} />
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySubtitle}>
                Your earnings and payouts will appear here once bookings are completed.
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx) => (
                <TransactionRow key={tx._id} tx={tx} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <BankFormModal
        visible={showBankModal}
        onClose={() => setShowBankModal(false)}
        initialValues={account?.bankAccount}
      />
      <UpiFormModal
        visible={showUpiModal}
        onClose={() => setShowUpiModal(false)}
        initialUpiId={account?.upiId}
      />
      <PayoutModal
        visible={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        availableBalance={summary?.availableBalance ?? 0}
        preferredMethod={preferredMethod}
      />

      <BottomNav />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // space for BottomNav
  },

  // ── Page Header
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  pageTitle: {
    fontFamily: fonts.oswaldBold,
    fontSize: 28,
    color: colors.textPrimary,
  },

  // ── Summary Card
  summaryCard: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.lg,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  summaryCardSkeleton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  verifiedText: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    color: "#6EE7B7",
  },
  summaryBalance: {
    fontFamily: fonts.oswaldBold,
    fontSize: 42,
    color: colors.white,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  summaryStatsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  statChipWarn: {
    backgroundColor: "rgba(251,191,36,0.15)",
  },
  statChipLabel: {
    fontFamily: fonts.jostRegular,
    fontSize: 10,
    color: "rgba(255,255,255,0.65)",
  },
  statChipValue: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 13,
    color: colors.white,
  },
  payoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 4,
  },
  payoutBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  payoutBtnText: {
    fontFamily: fonts.oswaldSemiBold,
    fontSize: 15,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  payoutBtnTextDisabled: {
    color: "rgba(255,255,255,0.6)",
  },

  // ── Section Card
  sectionCard: {
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radii.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  sectionTitle: {
    fontFamily: fonts.oswaldSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    lineHeight: 17,
  },

  // ── Payout Account rows
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  payoutRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
  },
  payoutMethodIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  payoutMethodInfo: {
    flex: 1,
    gap: 1,
  },
  payoutMethodTitle: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  payoutMethodDetail: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  payoutMethodDetail2: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  payoutMethodEmpty: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: colors.navInactive,
    fontStyle: "italic",
  },
  payoutRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  preferredBtn: {
    padding: spacing.xs,
  },
  editIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E8F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: spacing.md,
  },
  preferredNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  preferredNoteText: {
    fontFamily: fonts.jostRegular,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  noAccountNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: "#FFFBEB",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  noAccountText: {
    fontFamily: fonts.jostRegular,
    fontSize: 12,
    color: "#92400E",
    flex: 1,
  },

  // ── Transaction filters
  filterScroll: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  filterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontFamily: fonts.jostMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.white,
  },

  // ── Transaction list
  txList: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },

  // ── Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: fonts.jostRegular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
});
