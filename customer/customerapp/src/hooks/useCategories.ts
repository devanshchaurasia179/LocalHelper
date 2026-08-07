import { useState, useCallback, useEffect } from "react";
import { fetchCategories } from "@/api/categories.api";
import type { Category } from "@/api/categories.api";

export interface UseCategoriesResult {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetchCategories();
      setCategories(res.data.categories);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? "Could not load service categories."
      );
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { categories, loading, error, refresh };
}
