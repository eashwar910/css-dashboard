import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { apiFetch } from '@/lib/api';
import { createApiStore } from '@/lib/apiStore';

// ─────────────────────────────────────────────────────────────────────────────
// useEpfs
//
// Event Proposal Forms from GET /api/epf (Notion: Documents > Event Proposal
// Forms), shared across the Events list, event dialog and Add Event form.
// uploadEpf saves a file to Notion linked to an event.
// ─────────────────────────────────────────────────────────────────────────────

export interface Epf {
  id: string;
  eventId: string | null;
  name: string;
  fileName: string | null;
  /** The Notion row for this EPF, which shows the file. */
  url: string;
  uploadedAt: string;
}

/** Vercel caps request bodies at 4.5 MB; the server rejects anything over 4 MB. */
export const MAX_EPF_BYTES = 4 * 1024 * 1024;

const store = createApiStore<{ epfs: Epf[] }, Epf[]>('epf', (res) => res.epfs, []);

export function useEpfs() {
  const { value: data, isLoading, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    store.ensureFresh();
  }, []);

  /** Newest first (the API already sorts that way). */
  const byEvent = useMemo(() => {
    const map: Record<string, Epf[]> = {};
    for (const epf of data) if (epf.eventId) (map[epf.eventId] ??= []).push(epf);
    return map;
  }, [data]);

  const uploadEpf = useCallback(async (eventId: string, file: File): Promise<Epf> => {
    const params = new URLSearchParams({
      eventId,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
    });
    const { epf } = await apiFetch<{ epf: Epf }>(`epf?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    store.update((epfs) => [epf, ...epfs]);
    return epf;
  }, []);

  return { data, byEvent, isLoading, error, uploadEpf };
}
