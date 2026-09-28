import { useCallback, useMemo } from 'react';
import type { AsyncResult, Document } from '@/lib/types';
import { useApiResource } from '@/hooks/useApiResource';
import { apiFetch } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// useDocuments
//
// Returns the Notion Documents data source (GET /api/documents) plus
// grouping helpers. addDocument saves a link or uploads a file to Notion
// (POST /api/documents) and then re-fetches the list.
// ─────────────────────────────────────────────────────────────────────────────

interface DocumentsResponse {
  documents: { id: string; name: string; url: string; icon: string; category: string | null }[];
}

export interface DocumentsResult extends AsyncResult<Document[]> {
  /** Documents grouped by their optional `category` field.
   *  Documents without a category appear under the key "Uncategorised". */
  byCategory: Record<string, Document[]>;
  addDocument: (input: NewDocument) => Promise<void>;
}

/** Vercel caps request bodies at 4.5 MB; the server rejects anything over 4 MB. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

export type NewDocument =
  | { name: string; type?: string; url: string; file?: undefined }
  | { name: string; type?: string; file: File; url?: undefined };

export function useDocuments(): DocumentsResult {
  const { data: response, isLoading, error, reload } = useApiResource<DocumentsResponse>('documents');

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

  const addDocument = useCallback(
    async (input: NewDocument) => {
      if (input.file) {
        const params = new URLSearchParams({
          name: input.name,
          filename: input.file.name,
          contentType: input.file.type || 'application/octet-stream',
        });
        if (input.type) params.set('type', input.type);
        await apiFetch(`documents?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: input.file,
        });
      } else {
        await apiFetch('documents', {
          method: 'POST',
          body: JSON.stringify({ name: input.name, type: input.type, url: input.url }),
        });
      }
      reload();
    },
    [reload]
  );

  return {
    data,
    isLoading,
    error,
    byCategory,
    addDocument,
  };
}
