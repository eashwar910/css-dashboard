import { useMemo } from 'react';
import type { AsyncResult, Document } from '@/lib/types';
import { useApiResource } from '@/hooks/useApiResource';

// ─────────────────────────────────────────────────────────────────────────────
// useDocuments
//
// Returns the Notion Documents data source (GET /api/documents) plus
// grouping helpers.
// ─────────────────────────────────────────────────────────────────────────────

interface DocumentsResponse {
  documents: { id: string; name: string; url: string; icon: string; category: string | null }[];
}

export interface DocumentsResult extends AsyncResult<Document[]> {
  /** Documents grouped by their optional `category` field.
   *  Documents without a category appear under the key "Uncategorised". */
  byCategory: Record<string, Document[]>;
}

export function useDocuments(): DocumentsResult {
  const { data: response, isLoading, error } = useApiResource<DocumentsResponse>('documents');

  const data = useMemo<Document[]>(
    () =>
      (response?.documents ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        url: d.url,
        icon: d.icon,
        category: d.category ?? undefined,
      })),
    [response]
  );

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
