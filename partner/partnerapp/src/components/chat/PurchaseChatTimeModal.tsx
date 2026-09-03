/**
 * Purchase Chat Time Modal (Partner)
 * 
 * Modal for partners to purchase chat time (₹10 per minute)
 * Shows pricing options, wallet balance, and handles payment flow
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface PurchaseChatTimeModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchase: (minutes: number) => Promise<void>;
  walletBalance: number;
  currentRemainingSeconds?: number;
}

const RATE_PER_MINUTE = 10;

const PRESET_OPTIONS = [
  { minutes: 1, label: "1 min" },
  { minutes: 5, label: "5 mins" },
  { minutes: 10, label: "10 mins" },
  { minutes: 30, label: "30 mins" },
];

export default function PurchaseChatTimeModal({
  visible,
  onClose,
  onPurchase,
  walletBalance,
  currentRemainingSeconds = 0,
}: PurchaseChatTimeModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(5);
  const [loading, setLoading] = useState(false);

  const totalCost = selectedMinutes * RATE_PER_MINUTE;
  const canAfford = walletBalance >= totalCost;

  const handlePurchase = async () => {
    if (!canAfford) {
      Alert.alert(
        "Insufficient Balance",
        `You need ₹${totalCost} but only have ₹${walletBalance}. Please top up your wallet first.`
      );
      return;
    }

    setLoading(true);
    try {
      await onPurchase(selectedMinutes);
      onClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "Failed to purchase chat time. Please try again.";
      Alert.alert("Purchase Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="time-outline" size={28} color="#16493c" />
            </View>
            <Text style={styles.title}>Purchase Chat Time</Text>
            <Text style={styles.subtitle}>
              Continue your conversation with secure messaging
            </Text>
          </View>

          {/* Current Time Remaining */}
          {currentRemainingSeconds > 0 && (
            <View style={styles.currentTimeWrap}>
              <Text style={styles.currentTimeLabel}>Time remaining:</Text>
              <Text style={styles.currentTimeValue}>{formatTime(currentRemainingSeconds)}</Text>
            </View>
          )}

          {/* Pricing Info */}
          <View style={styles.pricingBanner}>
            <Text style={styles.pricingText}>₹{RATE_PER_MINUTE} per minute</Text>
          </View>

          {/* Time Options */}
          <View style={styles.optionsWrap}>
            <Text style={styles.sectionLabel}>Select time:</Text>
            <View style={styles.optionsGrid}>
              {PRESET_OPTIONS.map((option) => {
                const cost = option.minutes * RATE_PER_MINUTE;
                const isSelected = selectedMinutes === option.minutes;
                const affordable = walletBalance >= cost;

                return (
                  <Pressable
                    key={option.minutes}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                      !affordable && styles.optionCardDisabled,
                    ]}
                    onPress={() => setSelectedMinutes(option.minutes)}
                    disabled={!affordable}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                        !affordable && styles.optionLabelDisabled,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.optionPrice,
                        isSelected && styles.optionPriceSelected,
                        !affordable && styles.optionPriceDisabled,
                      ]}
                    >
                      ₹{cost}
                    </Text>
                    {!affordable && (
                      <View style={styles.insufficientBadge}>
                        <Text style={styles.insufficientText}>Low balance</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Wallet Balance */}
          <View style={styles.balanceWrap}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Wallet Balance:</Text>
              <Text style={styles.balanceValue}>₹{walletBalance.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Total Cost:</Text>
              <Text style={[styles.balanceValue, !canAfford && styles.balanceValueError]}>
                ₹{totalCost.toFixed(2)}
              </Text>
            </View>
            {canAfford && (
              <View style={[styles.balanceRow, styles.balanceAfter]}>
                <Text style={styles.balanceAfterLabel}>Balance After:</Text>
                <Text style={styles.balanceAfterValue}>
                  ₹{(walletBalance - totalCost).toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                (!canAfford || loading) && styles.btnDisabled,
              ]}
              onPress={handlePurchase}
              disabled={!canAfford || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.btnPrimaryText}>
                    Purchase {selectedMinutes} min{selectedMinutes > 1 ? "s" : ""}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {!canAfford && (
            <Text style={styles.warningText}>
              Insufficient balance. Top up your wallet to continue.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },

  currentTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  currentTimeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#92400E",
  },
  currentTimeValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
  },

  pricingBanner: {
    backgroundColor: "#16493c",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  pricingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  optionsWrap: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 10,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  optionCardSelected: {
    backgroundColor: "#ECFDF5",
    borderColor: "#16493c",
  },
  optionCardDisabled: {
    opacity: 0.5,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: "#16493c",
  },
  optionLabelDisabled: {
    color: "#6B7280",
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  optionPriceSelected: {
    color: "#16493c",
  },
  optionPriceDisabled: {
    color: "#6B7280",
  },
  insufficientBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  insufficientText: {
    fontSize: 9,
    fontWeight: "500",
    color: "#DC2626",
  },

  balanceWrap: {
    backgroundColor: "#F9FAFB",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 6,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  balanceValueError: {
    color: "#EF4444",
  },
  balanceAfter: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 6,
  },
  balanceAfterLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  balanceAfterValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16493c",
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  btnSecondary: {
    backgroundColor: "#F3F4F6",
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  btnPrimary: {
    backgroundColor: "#16493c",
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.5,
  },

  warningText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#EF4444",
    textAlign: "center",
    marginTop: 10,
  },
});
