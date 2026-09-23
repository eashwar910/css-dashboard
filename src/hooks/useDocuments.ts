import { useState, useEffect, useMemo } from 'react';
import type { AsyncResult, Document } from '@/lib/types';
import { mockDocuments } from '@/data';

// ─────────────────────────────────────────────────────────────────────────────
// useDocuments
//
// Returns all linked documents plus grouping helpers.
// Simulates an artificial latency (350ms) to exercise loading/empty/error states.
//
// FUTURE: Replace the setTimeout block with a Notion page-list fetch:
//   const { data, isLoading, error } = useSWR<Document[]>('/api/documents', fetcher);
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentsResult extends AsyncResult<Document[]> {
  /** Documents grouped by their optional `category` field.
   *  Documents without a category appear under the key "Uncategorised". */
  byCategory: Record<string, Document[]>;
}

export function useDocuments(): DocumentsResult {
  const [data, setData] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(mockDocuments);
      setIsLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  const byCategory = useMemo<Record<string, Document[]>>(
    () =>
      data.reduce<Record<string, Document[]>>((acc, doc) => {
        const key = doc.category ?? 'Uncategorised';
        if (!acc[key]) acc[key] = [];
        acc[key].push(doc);
        return acc;
      }, {}),
    [data]
  );

  return {
    data,
    isLoading,
    error,
    byCategory,
  };
}
