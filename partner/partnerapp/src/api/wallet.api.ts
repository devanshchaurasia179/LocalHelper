/**
 * wallet.api.ts
 *
 * All HTTP calls for partner wallet, transactions, and payout account operations.
 */

import { api } from "@/constants/api";

// ─── Wallet Summary ───────────────────────────────────────────────────────────

export interface WalletSummary {
  walletBalance: number;
  totalEarnings: number;
  pendingPayout: number;
  availableBalance: number;
}

export interface WalletSummaryResponse {
  summary: WalletSummary;
}

export async function fetchWalletSummary(): Promise<WalletSummary> {
  const res = await api.get<WalletSummaryResponse>("/partner/transactions/summary");
  return res.data.summary;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TransactionType = "earning" | "payout" | "adjustment";
export type TransactionStatus = "pending" | "processing" | "completed" | "failed";
export type TransactionDirection = "credit" | "debit";

export interface TransactionBooking {
  _id: string;
  scheduledAt: string;
  completedAt?: string;
  visitingCredit?: number;
}

export interface PayoutDetails {
  method: "bank" | "upi" | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  upiId: string | null;
}

export interface Transaction {
  _id: string;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  balanceAfter: number;
  status: TransactionStatus;
  booking?: TransactionBooking | null;
  payoutDetails?: PayoutDetails;
  description: string;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface FetchTransactionsParams {
  type?: TransactionType;
  status?: TransactionStatus;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export async function fetchTransactions(
  params: FetchTransactionsParams = {}
): Promise<TransactionListResponse> {
  const res = await api.get<TransactionListResponse>("/partner/transactions", { params });
  return res.data;
}

export async function fetchTransactionById(id: string): Promise<Transaction> {
  const res = await api.get<{ transaction: Transaction }>(`/partner/transactions/${id}`);
  return res.data.transaction;
}

// ─── Payout Request ───────────────────────────────────────────────────────────

export interface PayoutRequestPayload {
  amount: number;
}

export interface PayoutRequestResponse {
  message: string;
  transaction: {
    id: string;
    amount: number;
    status: TransactionStatus;
    payoutDetails: PayoutDetails;
    createdAt: string;
  };
}

export async function requestPayout(
  payload: PayoutRequestPayload
): Promise<PayoutRequestResponse> {
  const res = await api.post<PayoutRequestResponse>(
    "/partner/transactions/payout-request",
    payload
  );
  return res.data;
}

// ─── Transaction Account (Payout Details) ────────────────────────────────────

export interface BankAccount {
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  branchName: string | null;
}

export interface TransactionAccount {
  bankAccount: BankAccount | null;
  upiId: string | null;
  preferredMethod: "bank" | "upi" | null;
  isVerified: boolean;
  verifiedAt: string | null;
}

export interface TransactionAccountResponse {
  transactionAccount: TransactionAccount | null;
}

export async function fetchTransactionAccount(): Promise<TransactionAccount | null> {
  const res = await api.get<TransactionAccountResponse>("/partner/transaction-account");
  return res.data.transactionAccount;
}

// ─── Save Bank Account ────────────────────────────────────────────────────────

export interface SaveBankAccountPayload {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
}

export async function saveBankAccount(
  payload: SaveBankAccountPayload
): Promise<{ message: string; transactionAccount: TransactionAccount }> {
  const res = await api.put<{ message: string; transactionAccount: TransactionAccount }>(
    "/partner/transaction-account/bank",
    payload
  );
  return res.data;
}

// ─── Save UPI ID ──────────────────────────────────────────────────────────────

export async function saveUpiId(
  upiId: string
): Promise<{ message: string; transactionAccount: TransactionAccount }> {
  const res = await api.put<{ message: string; transactionAccount: TransactionAccount }>(
    "/partner/transaction-account/upi",
    { upiId }
  );
  return res.data;
}

// ─── Set Preferred Method ─────────────────────────────────────────────────────

export async function setPreferredMethod(
  method: "bank" | "upi"
): Promise<{ message: string; preferredMethod: "bank" | "upi" }> {
  const res = await api.patch<{ message: string; preferredMethod: "bank" | "upi" }>(
    "/partner/transaction-account/preferred-method",
    { method }
  );
  return res.data;
}

// ─── Delete Bank Account ──────────────────────────────────────────────────────

export async function deleteBankAccount(): Promise<{
  message: string;
  transactionAccount: TransactionAccount;
}> {
  const res = await api.delete<{ message: string; transactionAccount: TransactionAccount }>(
    "/partner/transaction-account/bank"
  );
  return res.data;
}

// ─── Delete UPI ID ────────────────────────────────────────────────────────────

export async function deleteUpiId(): Promise<{
  message: string;
  transactionAccount: TransactionAccount;
}> {
  const res = await api.delete<{ message: string; transactionAccount: TransactionAccount }>(
    "/partner/transaction-account/upi"
  );
  return res.data;
}
