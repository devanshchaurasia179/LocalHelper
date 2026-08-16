import { api } from "@/constants/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TxType = "topup" | "booking" | "refund" | "adjustment" | "call" | "chat";
export type TxStatus = "pending" | "processing" | "completed" | "failed";
export type TxDirection = "credit" | "debit";

export interface TxBooking {
  _id: string;
  scheduledAt?: string;
  completedAt?: string;
  visitingCredit?: number;
  serviceAddress?: {
    house?: string;
    street?: string;
    locality?: string;
    city: string;
    state: string;
    pincode: string;
  };
  description?: string;
  status?: string;
  partner?: { name?: string; phone?: string } | null;
  category?: { name?: string } | null;
  serviceLabel?: string | null;
}

export interface Transaction {
  _id: string;
  type: TxType;
  amount: number;
  direction: TxDirection;
  balanceAfter: number;
  status: TxStatus;
  booking?: TxBooking | null;
  description?: string;
  failureReason?: string | null;
  paymentDetails?: {
    gateway?: string | null;
    gatewayOrderId?: string | null;
    gatewayPaymentId?: string | null;
    paymentMethod?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletSummary {
  walletBalance: number;
  totalTopups: number;
  totalSpent: number;
  totalRefunds: number;
}

export interface TransactionListParams {
  type?: TxType;
  status?: TxStatus;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** GET /api/customer/transactions/summary */
export const fetchWalletSummary = (): Promise<{ summary: WalletSummary }> =>
  api.get("/customer/transactions/summary").then((r) => r.data);

/** GET /api/customer/transactions */
export const fetchTransactions = (
  params: TransactionListParams = {}
): Promise<TransactionListResponse> =>
  api.get("/customer/transactions", { params }).then((r) => r.data);

/** GET /api/customer/transactions/:id */
export const fetchTransactionById = (id: string): Promise<{ transaction: Transaction }> =>
  api.get(`/customer/transactions/${id}`).then((r) => r.data);

/** POST /api/customer/transactions/topup */
export const initiateTopup = (amount: number): Promise<{
  message: string;
  transaction: { id: string; amount: number; balanceAfter: number; status: string; createdAt: string };
  walletBalance: number;
}> => api.post("/customer/transactions/topup", { amount }).then((r) => r.data);
