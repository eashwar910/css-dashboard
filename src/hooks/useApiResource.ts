import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// useApiResource
//
// Fetches one GET /api/* resource on mount. Shared by the data hooks so each
// one only maps the response into its own return shape.
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResource<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  /** Re-fetch the resource (e.g. after a write). */
  reload: () => void;
}

export function useApiResource<T>(path: string): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch<T>(path)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(`Failed to load /api/${path}`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, isLoading, error, reload };
}
