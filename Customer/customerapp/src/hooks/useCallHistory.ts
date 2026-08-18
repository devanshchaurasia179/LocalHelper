import { useState, useEffect, useCallback } from "react";
import { getCustomerCallHistory, type CallRecord } from "@/api/call.api";

export function useCallHistory() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchCalls = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      setError(null);
      const response = await getCustomerCallHistory(pageNum, 20);

      if (response.success) {
        if (pageNum === 1) {
          setCalls(response.calls);
        } else {
          setCalls((prev) => [...prev, ...response.calls]);
        }
        setHasMore(pageNum < response.pagination.pages);
        setPage(pageNum);
      } else {
        setError("Failed to load call history");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load call history");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls(1);
  }, [fetchCalls]);

  const refresh = useCallback(() => {
    fetchCalls(1, true);
  }, [fetchCalls]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchCalls(page + 1);
    }
  }, [loadingMore, hasMore, page, fetchCalls]);

  return {
    calls,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}
