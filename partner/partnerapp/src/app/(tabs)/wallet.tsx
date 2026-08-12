import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radii } from "@/constants/theme";
import BottomNav from "@/components/navigation/BottomNav";
import {
  useWalletSummary,
  useTransactions,
  useRequestPayout,
  useTransactionAccount,
  useSaveBankAccount,
  useSaveUpiId,
  useSetPreferredMethod,
  useDeleteBankAccount,
  useDeleteUpiId,
} from "@/hooks/useWallet";
import type { Transaction, SaveBankAccountPayload } from "@/api/wallet.api";

// ─── Transaction Type Icons & Colors ──────────────────────────────────────────

const TX_META: Record<
  "earning" | "payout" | "adjustment",
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  earning:    { icon: "trending-up",    color: colors.success, bg: colors.successLight },
  payout:     { icon: "arrow-down",     color: "#6366F1",      bg: "#EEF2FF" },
  adjustment: { icon: "swap-horizontal", color: "#F59E0B",      bg: "#FFFBEB" },
};

const STATUS_META: Record<
  "pending" | "processing" | "completed" | "failed",
  { label: string; color: string }
> = {
  pending:    { label: "Pending",    color: "#F59E0B" },
  processing: { label: "Processing", color: "#3B82F6" },
  completed:  { label: "Completed",  color: colors.success },
  failed:     { label: "Failed",     color: colors.error },
};

// ─── Payout Request Modal ─────────────────────────────────────────────────────

function PayoutModal({
  visible,
  onClose,
  availableBalance,
  onConfirm,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  availableBalance: number;
  onConfirm: (amount: number) => void;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState("");

  const handleConfirm = () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      Alert.alert("Invalid Amount", "Enter a valid amount greater than 0.");
      return;
    }
    if (num > availableBalance) {
      Alert.alert("Insufficient Balance", `You can withdraw up to ₹${availableBalance}.`);
      return;
    }
    onConfirm(num);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={payoutStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={payoutStyles.sheet}>
          <View style={payoutStyles.handle} />
          <View style={payoutStyles.iconWrap}>
            <Ionicons name="cash-outline" size={28} color={colors.primary} />
          </View>
          <Text style={payoutStyles.title}>Request Payout</Text>
          <Text style={payoutStyles.subtitle}>
            Available balance: ₹{availableBalance.toFixed(2)}
          </Text>

          <View style={payoutStyles.inputWrap}>
            <Text style={payoutStyles.inputLabel}>Amount</Text>
            <View style={payoutStyles.inputRow}>
              <Text style={payoutStyles.currencySymbol}>₹</Text>
              <TextInput
                style={payoutStyles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                autoFocus
              />
            </View>
          </View>

          <View style={payoutStyles.actions}>
            <Pressable
              style={[payoutStyles.confirmBtn, !amount && payoutStyles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!amount || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={payoutStyles.confirmBtnText}>Request Payout</Text>
              )}
            </Pressable>
            <Pressable style={payoutStyles.cancelBtn} onPress={onClose} disabled={isLoading}>
              <Text style={payoutStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const payoutStyles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: spacing.sm, alignItems: "center" },
  handle:       { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, marginBottom: spacing.lg },
  iconWrap:     { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title:        { fontFamily: fonts.oswaldBold, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle:     { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg },
  inputWrap:    { alignSelf: "stretch", marginBottom: spacing.lg },
  inputLabel:   { fontFamily: fonts.jakartaSemiBold, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.xs },
  inputRow:     { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  currencySymbol: { fontFamily: fonts.oswaldBold, fontSize: 24, color: colors.textPrimary, marginRight: spacing.xs },
  input:        { flex: 1, fontFamily: fonts.oswaldBold, fontSize: 24, color: colors.textPrimary, paddingVertical: spacing.md },
  actions:      { width: "100%", gap: spacing.sm },
  confirmBtn:   { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 14, alignItems: "center" },
  confirmBtnDisabled: { backgroundColor: "#9CA3AF" },
  confirmBtnText: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.white },
  cancelBtn:    { alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontFamily: fonts.jakartaMedium, fontSize: 14, color: colors.textSecondary },
});

// ─── Bank / UPI Edit Modal ────────────────────────────────────────────────────

type EditMode = "bank" | "upi" | null;

function AccountEditModal({
  visible,
  mode,
  onClose,
  onSaveBank,
  onSaveUpi,
  isLoading,
  existingBank,
  existingUpi,
}: {
  visible: boolean;
  mode: EditMode;
  onClose: () => void;
  onSaveBank: (data: SaveBankAccountPayload) => void;
  onSaveUpi: (upiId: string) => void;
  isLoading: boolean;
  existingBank?: { accountHolderName: string | null; accountNumber: string | null; ifscCode: string | null; bankName: string | null; branchName: string | null } | null;
  existingUpi?: string | null;
}) {
  const [holderName, setHolderName] = useState(existingBank?.accountHolderName ?? "");
  const [accountNumber, setAccountNumber] = useState(existingBank?.accountNumber ?? "");
  const [ifsc, setIfsc] = useState(existingBank?.ifscCode ?? "");
  const [bankName, setBankName] = useState(existingBank?.bankName ?? "");
  const [branch, setBranch] = useState(existingBank?.branchName ?? "");
  const [upiId, setUpiId] = useState(existingUpi ?? "");

  const handleSave = () => {
    if (mode === "bank") {
      if (!holderName.trim() || !accountNumber.trim() || !ifsc.trim() || !bankName.trim()) {
        Alert.alert("Missing Fields", "Fill in all required fields.");
        return;
      }
      onSaveBank({ accountHolderName: holderName.trim(), accountNumber: accountNumber.trim(), ifscCode: ifsc.trim().toUpperCase(), bankName: bankName.trim(), branchName: branch.trim() || undefined });
    } else if (mode === "upi") {
      if (!upiId.trim()) {
        Alert.alert("Missing UPI ID", "Enter your UPI ID.");
        return;
      }
      onSaveUpi(upiId.trim());
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={editStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={editStyles.sheet}>
          <View style={editStyles.handle} />
          <Text style={editStyles.title}>{mode === "bank" ? "Bank Account" : "UPI ID"}</Text>

          <ScrollView style={editStyles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {mode === "bank" && (
              <>
                <Text style={editStyles.label}>Account Holder Name *</Text>
                <TextInput style={editStyles.input} value={holderName} onChangeText={setHolderName} placeholder="Full Name" placeholderTextColor={colors.textSecondary} />
                <Text style={editStyles.label}>Account Number *</Text>
                <TextInput style={editStyles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="123456789012" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                <Text style={editStyles.label}>IFSC Code *</Text>
                <TextInput style={editStyles.input} value={ifsc} onChangeText={setIfsc} placeholder="SBIN0001234" placeholderTextColor={colors.textSecondary} autoCapitalize="characters" />
                <Text style={editStyles.label}>Bank Name *</Text>
                <TextInput style={editStyles.input} value={bankName} onChangeText={setBankName} placeholder="State Bank of India" placeholderTextColor={colors.textSecondary} />
                <Text style={editStyles.label}>Branch Name (optional)</Text>
                <TextInput style={editStyles.input} value={branch} onChangeText={setBranch} placeholder="MG Road" placeholderTextColor={colors.textSecondary} />
              </>
            )}
            {mode === "upi" && (
              <>
                <Text style={editStyles.label}>UPI ID *</Text>
                <TextInput style={editStyles.input} value={upiId} onChangeText={setUpiId} placeholder="9876543210@upi" placeholderTextColor={colors.textSecondary} keyboardType="email-address" autoCapitalize="none" />
              </>
            )}
          </ScrollView>

          <View style={editStyles.actions}>
            <Pressable style={editStyles.saveBtn} onPress={handleSave} disabled={isLoading}>
              {isLoading ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={editStyles.saveBtnText}>Save</Text>}
            </Pressable>
            <Pressable style={editStyles.cancelBtn} onPress={onClose} disabled={isLoading}>
              <Text style={editStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: spacing.sm, maxHeight: "85%" },
  handle:      { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, marginBottom: spacing.md, alignSelf: "center" },
  title:       { fontFamily: fonts.oswaldBold, fontSize: 20, color: colors.textPrimary, marginBottom: spacing.md },
  scroll:      { maxHeight: 350, marginBottom: spacing.md },
  label:       { fontFamily: fonts.jakartaSemiBold, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input:       { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  actions:     { gap: spacing.sm },
  saveBtn:     { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.white },
  cancelBtn:   { alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontFamily: fonts.jakartaMedium, fontSize: 14, color: colors.textSecondary },
});

// ─── Main Wallet Screen ───────────────────────────────────────────────────────

export default function WalletScreen() {
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useWalletSummary();
  const { data: txData, isLoading: txLoading, refetch: refetchTx } = useTransactions({ page: 1, limit: 10 });
  const { data: account, isLoading: accountLoading, refetch: refetchAccount } = useTransactionAccount();

  const payoutMutation = useRequestPayout();
  const saveBankMutation = useSaveBankAccount();
  const saveUpiMutation = useSaveUpiId();
  const setPreferredMutation = useSetPreferredMethod();
  const deleteBankMutation = useDeleteBankAccount();
  const deleteUpiMutation = useDeleteUpiId();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchTx(), refetchAccount()]);
    setRefreshing(false);
  }, [refetchSummary, refetchTx, refetchAccount]);

  const handlePayoutRequest = useCallback((amount: number) => {
    payoutMutation.mutate(amount, {
      onSuccess: () => {
        Alert.alert("Success", "Payout requested. It will be processed within 2–3 business days.");
        setPayoutModalVisible(false);
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message ?? "Could not request payout.");
      },
    });
  }, [payoutMutation]);

  const handleSaveBank = useCallback((data: SaveBankAccountPayload) => {
    saveBankMutation.mutate(data, {
      onSuccess: () => {
        Alert.alert("Success", "Bank account saved.");
        setEditModalVisible(false);
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message ?? "Could not save bank account.");
      },
    });
  }, [saveBankMutation]);

  const handleSaveUpi = useCallback((upiId: string) => {
    saveUpiMutation.mutate(upiId, {
      onSuccess: () => {
        Alert.alert("Success", "UPI ID saved.");
        setEditModalVisible(false);
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message ?? "Could not save UPI ID.");
      },
    });
  }, [saveUpiMutation]);

  const handleEditBank = () => { setEditMode("bank"); setEditModalVisible(true); };
  const handleEditUpi = () => { setEditMode("upi"); setEditModalVisible(true); };

  const handleDeleteBank = () => {
    Alert.alert("Delete Bank Account", "Remove your saved bank account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteBankMutation.mutate() },
    ]);
  };

  const handleDeleteUpi = () => {
    Alert.alert("Delete UPI ID", "Remove your saved UPI ID?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteUpiMutation.mutate() },
    ]);
  };

  const handleSetPreferred = (method: "bank" | "upi") => {
    setPreferredMutation.mutate(method, {
      onSuccess: () => Alert.alert("Success", `Preferred payout method set to ${method === "bank" ? "Bank Transfer" : "UPI"}.`),
      onError: (err: any) => Alert.alert("Error", err?.response?.data?.message ?? "Could not update preferred method."),
    });
  };

  const walletBalance = summary?.walletBalance ?? 0;
  const totalEarnings = summary?.totalEarnings ?? 0;
  const pendingPayout = summary?.pendingPayout ?? 0;
  const availableBalance = summary?.availableBalance ?? 0;
  const transactions = txData?.transactions ?? [];

  const hasBankAccount = account?.bankAccount?.accountNumber != null;
  const hasUpiId = account?.upiId != null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
        </View>

        {/* Balance Card */}
        {summaryLoading ? (
          <View style={styles.balanceCard}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>₹{availableBalance.toFixed(2)}</Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceItemLabel}>Total Earnings</Text>
                <Text style={styles.balanceItemValue}>₹{totalEarnings}</Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceItemLabel}>Pending Payout</Text>
                <Text style={styles.balanceItemValue}>₹{pendingPayout}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.payoutBtn, availableBalance <= 0 && styles.payoutBtnDisabled]}
              onPress={() => setPayoutModalVisible(true)}
              disabled={availableBalance <= 0}
            >
              <Ionicons name="arrow-down-circle" size={18} color={colors.white} />
              <Text style={styles.payoutBtnText}>Request Payout</Text>
            </Pressable>
          </View>
        )}

        {/* Payout Account Section */}
        <Text style={styles.sectionTitle}>Payout Account</Text>
        {accountLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : (
          <>
            {/* Bank Account */}
            <View style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <View style={styles.accountIconWrap}>
                  <Ionicons name="business-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.accountTitle}>Bank Account</Text>
                {account?.preferredMethod === "bank" && <View style={styles.preferredBadge}><Text style={styles.preferredText}>Preferred</Text></View>}
              </View>
              {hasBankAccount ? (
                <>
                  <Text style={styles.accountDetail}>{account.bankAccount?.accountHolderName}</Text>
                  <Text style={styles.accountDetail}>{account.bankAccount?.bankName}</Text>
                  <Text style={styles.accountDetailSub}>****{account.bankAccount?.accountNumber?.slice(-4)} · {account.bankAccount?.ifscCode}</Text>
                  <View style={styles.accountActions}>
                    <Pressable style={styles.accountBtn} onPress={handleEditBank}><Text style={styles.accountBtnText}>Edit</Text></Pressable>
                    <Pressable style={styles.accountBtn} onPress={handleDeleteBank}><Text style={[styles.accountBtnText, { color: colors.error }]}>Remove</Text></Pressable>
                    {account?.preferredMethod !== "bank" && <Pressable style={styles.accountBtn} onPress={() => handleSetPreferred("bank")}><Text style={styles.accountBtnText}>Set as Preferred</Text></Pressable>}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.accountEmpty}>No bank account added yet.</Text>
                  <Pressable style={styles.addBtn} onPress={handleEditBank}><Ionicons name="add-circle-outline" size={16} color={colors.primary} /><Text style={styles.addBtnText}>Add Bank Account</Text></Pressable>
                </>
              )}
            </View>

            {/* UPI */}
            <View style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <View style={styles.accountIconWrap}>
                  <Ionicons name="wallet-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.accountTitle}>UPI</Text>
                {account?.preferredMethod === "upi" && <View style={styles.preferredBadge}><Text style={styles.preferredText}>Preferred</Text></View>}
              </View>
              {hasUpiId ? (
                <>
                  <Text style={styles.accountDetail}>{account.upiId}</Text>
                  <View style={styles.accountActions}>
                    <Pressable style={styles.accountBtn} onPress={handleEditUpi}><Text style={styles.accountBtnText}>Edit</Text></Pressable>
                    <Pressable style={styles.accountBtn} onPress={handleDeleteUpi}><Text style={[styles.accountBtnText, { color: colors.error }]}>Remove</Text></Pressable>
                    {account?.preferredMethod !== "upi" && <Pressable style={styles.accountBtn} onPress={() => handleSetPreferred("upi")}><Text style={styles.accountBtnText}>Set as Preferred</Text></Pressable>}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.accountEmpty}>No UPI ID added yet.</Text>
                  <Pressable style={styles.addBtn} onPress={handleEditUpi}><Ionicons name="add-circle-outline" size={16} color={colors.primary} /><Text style={styles.addBtnText}>Add UPI ID</Text></Pressable>
                </>
              )}
            </View>
          </>
        )}

        {/* Recent Transactions */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {txLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySub}>Complete bookings to earn and request payouts.</Text>
          </View>
        ) : (
          transactions.map((tx) => <TransactionCard key={tx._id} transaction={tx} />)
        )}
      </ScrollView>

      <BottomNav />

      <PayoutModal
        visible={payoutModalVisible}
        onClose={() => setPayoutModalVisible(false)}
        availableBalance={availableBalance}
        onConfirm={handlePayoutRequest}
        isLoading={payoutMutation.isPending}
      />

      <AccountEditModal
        visible={editModalVisible}
        mode={editMode}
        onClose={() => setEditModalVisible(false)}
        onSaveBank={handleSaveBank}
        onSaveUpi={handleSaveUpi}
        isLoading={saveBankMutation.isPending || saveUpiMutation.isPending}
        existingBank={account?.bankAccount}
        existingUpi={account?.upiId}
      />
    </SafeAreaView>
  );
}

// ─── Transaction Card ─────────────────────────────────────────────────────────

function TransactionCard({ transaction }: { transaction: Transaction }) {
  const meta = TX_META[transaction.type];
  const statusMeta = STATUS_META[transaction.status];
  const isCredit = transaction.direction === "credit";

  const date = new Date(transaction.createdAt);
  const dateStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={txStyles.card}>
      <View style={[txStyles.iconWrap, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={txStyles.body}>
        <Text style={txStyles.description} numberOfLines={1}>{transaction.description}</Text>
        <View style={txStyles.meta}>
          <Text style={txStyles.date}>{dateStr} · {timeStr}</Text>
          {transaction.status !== "completed" && (
            <View style={[txStyles.statusBadge, { backgroundColor: `${statusMeta.color}15`, borderColor: `${statusMeta.color}50` }]}>
              <Text style={[txStyles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[txStyles.amount, isCredit && txStyles.amountCredit]}>
        {isCredit ? "+" : "-"}₹{transaction.amount}
      </Text>
    </View>
  );
}

const txStyles = StyleSheet.create({
  card:         { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm },
  iconWrap:     { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  body:         { flex: 1 },
  description:  { fontFamily: fonts.jakartaSemiBold, fontSize: 14, color: colors.textPrimary, marginBottom: 3 },
  meta:         { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  date:         { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary },
  statusBadge:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm, borderWidth: 1 },
  statusText:   { fontFamily: fonts.jakartaSemiBold, fontSize: 10 },
  amount:       { fontFamily: fonts.oswaldBold, fontSize: 16, color: colors.textPrimary },
  amountCredit: { color: colors.success },
});

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.background },
  scroll:        { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  header:        { paddingTop: spacing.md, marginBottom: spacing.lg },
  headerTitle:   { fontFamily: fonts.oswaldBold, fontSize: 28, color: colors.textPrimary },
  balanceCard:   { backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  balanceLabel:  { fontFamily: fonts.jostRegular, fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: spacing.xs },
  balanceAmount: { fontFamily: fonts.oswaldBold, fontSize: 36, color: colors.white, marginBottom: spacing.md },
  balanceRow:    { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  balanceItem:   { flex: 1 },
  balanceItemLabel: { fontFamily: fonts.jostRegular, fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 2 },
  balanceItemValue: { fontFamily: fonts.jakartaSemiBold, fontSize: 16, color: colors.white },
  balanceDivider:   { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: spacing.sm },
  payoutBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: radii.pill, paddingVertical: 12 },
  payoutBtnDisabled: { opacity: 0.5 },
  payoutBtnText:    { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.white },
  sectionTitle:     { fontFamily: fonts.oswaldBold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.sm },
  accountCard:      { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm },
  accountHeader:    { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  accountIconWrap:  { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.successLight, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  accountTitle:     { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.textPrimary, flex: 1 },
  preferredBadge:   { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.successBorder, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm },
  preferredText:    { fontFamily: fonts.jakartaSemiBold, fontSize: 10, color: colors.successDark },
  accountDetail:    { fontFamily: fonts.jakartaMedium, fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
  accountDetailSub: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  accountEmpty:     { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  accountActions:   { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  accountBtn:       { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.sm, borderWidth: 1, borderColor: "#D1D5DB" },
  accountBtnText:   { fontFamily: fonts.jakartaMedium, fontSize: 12, color: colors.primary },
  addBtn:           { flexDirection: "row", alignItems: "center", gap: 6 },
  addBtnText:       { fontFamily: fonts.jakartaSemiBold, fontSize: 13, color: colors.primary },
  emptyState:       { alignItems: "center", paddingVertical: spacing.xl, backgroundColor: colors.surface, borderRadius: radii.md },
  emptyText:        { fontFamily: fonts.oswaldBold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.sm },
  emptySub:         { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
});