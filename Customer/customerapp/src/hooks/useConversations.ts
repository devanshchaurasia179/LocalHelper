import { useState, useCallback, useEffect } from "react";
import { fetchMyConversations, type Conversation } from "@/api/chat.api";

export interface UseConversationsResult {
  conversations: Conversation[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches and manages the customer's conversation list.
 * Sorted by most recent message (server handles ordering).
 */
export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchMyConversations();
      setConversations(res.data.conversations);
      setError(null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? "Failed to load conversations."
      );
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { conversations, loading, refreshing, error, refresh };
}
