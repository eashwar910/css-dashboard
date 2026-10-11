import { useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useApiResource } from '@/hooks/useApiResource';

// ─────────────────────────────────────────────────────────────────────────────
// useLogistics
//
// The Inventory from GET /api/logistics (Notion: Team Dashboard > Logistics).
// save() creates or edits an item in Notion, remove() moves one to Notion's
// trash; both re-fetch the list.
// ─────────────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  item: string;
  /** Free text, e.g. "5 packs". */
  quantity: string | null;
  qtyNeeded: string | null;
  /** Who or where it's kept. */
  location: string | null;
  event: string | null;
  /** The Notion page. */
  url: string;
}

export type InventoryInput = Omit<InventoryItem, 'id' | 'url'>;

export function useLogistics() {
  const { data, isLoading, error, reload } = useApiResource<{ items: InventoryItem[] }>('logistics');
  const items = useMemo(() => data?.items ?? [], [data]);

  /** Create when id is omitted, otherwise edit that item. */
  const save = useCallback(
    async (input: InventoryInput, id?: string) => {
      await apiFetch(id ? `logistics?id=${encodeURIComponent(id)}` : 'logistics', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      });
      reload();
    },
    [reload]
  );

  /** Move an item to Notion's trash (restorable there for 30 days). */
  const remove = useCallback(
    async (id: string) => {
      await apiFetch(`logistics?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      reload();
    },
    [reload]
  );

  return { items, isLoading, error, save, remove };
}
