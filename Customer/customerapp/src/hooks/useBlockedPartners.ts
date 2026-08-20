import { useState, useEffect, useCallback } from "react";
import {
  getBlockedPartners,
  blockPartner,
  unblockPartner,
  type BlockedPartner,
} from "@/api/call.api";

export function useBlockedPartners() {
  const [partners, setPartners] = useState<BlockedPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlockedPartners = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const response = await getBlockedPartners();
      if (response.success) {
        setPartners(response.blockedPartners);
      } else {
        setError("Failed to load blocked partners");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load blocked partners");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockedPartners();
  }, [fetchBlockedPartners]);

  const refresh = useCallback(() => {
    fetchBlockedPartners(true);
  }, [fetchBlockedPartners]);

  const handleBlock = useCallback(async (partnerId: string) => {
    try {
      const response = await blockPartner(partnerId);
      if (response.success) {
        // Refresh the list
        await fetchBlockedPartners();
      }
      return response;
    } catch (err: any) {
      throw err;
    }
  }, [fetchBlockedPartners]);

  const handleUnblock = useCallback(async (partnerId: string) => {
    try {
      const response = await unblockPartner(partnerId);
      if (response.success) {
        // Optimistically remove from list
        setPartners((prev) => prev.filter((p) => p._id !== partnerId));
      }
      return response;
    } catch (err: any) {
      // Revert optimistic update on failure
      await fetchBlockedPartners();
      throw err;
    }
  }, [fetchBlockedPartners]);

  return {
    partners,
    loading,
    refreshing,
    error,
    refresh,
    block: handleBlock,
    unblock: handleUnblock,
  };
}
