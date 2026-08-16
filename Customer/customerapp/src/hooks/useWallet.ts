import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchWalletSummary,
  fetchTransactions,
  fetchTransactionById,
  initiateTopup,
} from "@/api/wallet.api";
import type {
  Transaction,
  WalletSummary,
  TransactionListParams,
  TxType,
  TxStatus,
} from "@/api/wallet.api";

// ─── useWalletSummary ─────────────────────────────────────────────────────────

export interface UseWalletSummaryResult {
  summary: WalletSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWalletSummary(): UseWalletSummaryResult {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchWalletSummary();
      setSummary(data.summary);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load wallet summary.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { summary, loading, error, refresh };
}

// ─── useTransactions ──────────────────────────────────────────────────────────

export interface UseTransactionsResult {
  transactions: Transaction[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  activeType: TxType | "all";
  setActiveType: (type: TxType | "all") => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useTransactions(
  initialParams: Omit<TransactionListParams, "page"> = {}
): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveTypeState] = useState<TxType | "all">("all");

  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const paramsRef = useRef(initialParams);

  const load = useCallback(async (
    type: TxType | "all",
    page: number,
    append: boolean
  ) => {
    try {
      const params: TransactionListParams = {
        ...paramsRef.current,
        page,
        limit: 15,
      };
      if (type !== "all") params.type = type;

      const data = await fetchTransactions(params);
      setTransactions((prev) =>
        append ? [...prev, ...data.transactions] : data.transactions
      );
      totalPagesRef.current = data.pagination.totalPages;
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load transactions.");
    }
  }, []);

  useEffect(() => {
    pageRef.current = 1;
    setLoading(true);
    load("all", 1, false).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveType = useCallback(
    (type: TxType | "all") => {
      setActiveTypeState(type);
      pageRef.current = 1;
      setLoading(true);
      load(type, 1, false).finally(() => setLoading(false));
    },
    [load]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    pageRef.current = 1;
    await load(activeType, 1, false);
    setRefreshing(false);
  }, [activeType, load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || pageRef.current >= totalPagesRef.current) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    setLoadingMore(true);
    await load(activeType, nextPage, true);
    setLoadingMore(false);
  }, [loadingMore, activeType, load]);

  return {
    transactions,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: pageRef.current < totalPagesRef.current,
    activeType,
    setActiveType,
    refresh,
    loadMore,
  };
}

// ─── useTransaction (single) ──────────────────────────────────────────────────

export interface UseTransactionResult {
  transaction: Transaction | null;
  /** Alias for loading — matches React Query API used in partner wallet */
  isLoading: boolean;
  loading: boolean;
  error: string | null;
}

export function useTransaction(
  id: string,
  enabled = true
): UseTransactionResult {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !enabled) return;
    setTransaction(null);
    setLoading(true);
    fetchTransactionById(id)
      .then((data) => {
        setTransaction(data.transaction);
        setError(null);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message ?? "Failed to load transaction.");
      })
      .finally(() => setLoading(false));
  }, [id, enabled]);

  return { transaction, isLoading: loading, loading, error };
}

// ─── useTopup ─────────────────────────────────────────────────────────────────

export interface UseTopupResult {
  isPending: boolean;
  topup: (
    amount: number,
    callbacks: {
      onSuccess: (newBalance: number) => void;
      onError: (message: string) => void;
    }
  ) => void;
}

export function useTopup(): UseTopupResult {
  const [isPending, setIsPending] = useState(false);

  const topup = useCallback(
    async (
      amount: number,
      callbacks: {
        onSuccess: (newBalance: number) => void;
        onError: (message: string) => void;
      }
    ) => {
      setIsPending(true);
      try {
        const data = await initiateTopup(amount);
        callbacks.onSuccess(data.walletBalance);
      } catch (err: any) {
        callbacks.onError(
          err?.response?.data?.message ?? "Could not add funds. Please try again."
        );
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { isPending, topup };
}
