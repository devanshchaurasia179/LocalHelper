/**
 * useWallet.ts
 *
 * React Query hooks for wallet summary, transaction history,
 * and payout account management.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWalletSummary,
  fetchTransactions,
  fetchTransactionById,
  requestPayout,
  fetchTransactionAccount,
  saveBankAccount,
  saveUpiId,
  setPreferredMethod,
  deleteBankAccount,
  deleteUpiId,
  type FetchTransactionsParams,
  type SaveBankAccountPayload,
} from "@/api/wallet.api";

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const WALLET_SUMMARY_KEY    = ["partner", "wallet", "summary"]  as const;
export const TRANSACTIONS_KEY      = ["partner", "wallet", "transactions"] as const;
export const TRANSACTION_ACCOUNT_KEY = ["partner", "wallet", "account"] as const;

// ─── Wallet Summary ───────────────────────────────────────────────────────────

/**
 * Fetches the partner's wallet summary (balance, earnings, pending payout).
 */
export function useWalletSummary(enabled = true) {
  return useQuery({
    queryKey: WALLET_SUMMARY_KEY,
    queryFn:  fetchWalletSummary,
    enabled,
    staleTime: 30_000,
  });
}

// ─── Transaction History ──────────────────────────────────────────────────────

/**
 * Fetches the partner's transaction history with optional filters.
 */
export function useTransactions(params: FetchTransactionsParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, params],
    queryFn:  () => fetchTransactions(params),
    enabled,
    staleTime: 15_000,
  });
}

/**
 * Fetches a single transaction by ID.
 */
export function useTransaction(id: string, enabled = true) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, id],
    queryFn:  () => fetchTransactionById(id),
    enabled:  enabled && !!id,
  });
}

// ─── Payout Request ───────────────────────────────────────────────────────────

/**
 * Mutation to request a payout. Invalidates summary and transactions on success.
 */
export function useRequestPayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (amount: number) => requestPayout({ amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WALLET_SUMMARY_KEY });
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    },
  });
}

// ─── Transaction Account ──────────────────────────────────────────────────────

/**
 * Fetches the partner's saved payout account details (bank + UPI).
 */
export function useTransactionAccount(enabled = true) {
  return useQuery({
    queryKey: TRANSACTION_ACCOUNT_KEY,
    queryFn:  fetchTransactionAccount,
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Mutation to save/update bank account details.
 */
export function useSaveBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveBankAccountPayload) => saveBankAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_ACCOUNT_KEY });
    },
  });
}

/**
 * Mutation to save/update UPI ID.
 */
export function useSaveUpiId() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (upiId: string) => saveUpiId(upiId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_ACCOUNT_KEY });
    },
  });
}

/**
 * Mutation to set the preferred payout method.
 */
export function useSetPreferredMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (method: "bank" | "upi") => setPreferredMethod(method),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_ACCOUNT_KEY });
    },
  });
}

/**
 * Mutation to delete saved bank account.
 */
export function useDeleteBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_ACCOUNT_KEY });
    },
  });
}

/**
 * Mutation to delete saved UPI ID.
 */
export function useDeleteUpiId() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUpiId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_ACCOUNT_KEY });
    },
  });
}
