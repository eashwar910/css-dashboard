import { apiFetch } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// createApiStore
//
// A tiny module-level store for one GET /api/* resource, shared by every
// component that uses it (for useSyncExternalStore). Loads at most once per
// `reloadAfterMs`; local edits go through `update` and last until reload.
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiStoreState<T> {
  value: T;
  isLoading: boolean;
  error: Error | null;
  loadedAt: number;
}

export function createApiStore<TResponse, T>(
  path: string,
  map: (response: TResponse) => T,
  initial: T,
  reloadAfterMs = 60_000
) {
  let state: ApiStoreState<T> = { value: initial, isLoading: true, error: null, loadedAt: 0 };
  let inflight: Promise<void> | null = null;
  // Bumped by every local `update`; a load that started before one is stale.
  let version = 0;
  const listeners = new Set<() => void>();

  const setState = (patch: Partial<ApiStoreState<T>>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  const load = (): Promise<void> => {
    const startedAt = version;
    inflight ??= apiFetch<TResponse>(path)
      .then((res) => {
        // Don't clobber local edits made while this request was in flight.
        if (version === startedAt) setState({ value: map(res), error: null, loadedAt: Date.now() });
      })
      .catch((err: unknown) => {
        console.error(`Failed to load /api/${path}`, err);
        setState({ error: err instanceof Error ? err : new Error(String(err)) });
      })
      .finally(() => {
        inflight = null;
        setState({ isLoading: false });
      });
    return inflight;
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    /** Load unless loaded within reloadAfterMs. */
    ensureFresh() {
      if (Date.now() - state.loadedAt > reloadAfterMs) void load();
    },
    reload: load,
    /** Replace the value locally (not saved anywhere). */
    update(fn: (value: T) => T) {
      version++;
      setState({ value: fn(state.value) });
    },
  };
}
