import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { apiFetch } from '@/lib/api';
import { createApiStore } from '@/lib/apiStore';
import { addTaskFromServer, type TaskDto } from '@/hooks/useTasks';

// ─────────────────────────────────────────────────────────────────────────────
// useTaskRequests
//
// GET /api/task-requests: pending tasks other members have assigned to me
// (shown as accept-only notifications), whether I may assign tasks myself
// (President, Vice President, Head of Tech), and who I can assign to.
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskRequest {
  id: string;
  title: string;
  dueDate: string | null;
  requestedBy: string | null;
  requestedAt: string;
}

export interface AssignableMember {
  email: string;
  name: string;
  role: string | null;
  /** Their Notion user id (matches task assignees), or null if not linked. */
  notionUserId: string | null;
}

interface TaskRequestsValue {
  requests: TaskRequest[];
  canAssign: boolean;
  members: AssignableMember[];
}

const store = createApiStore<Partial<TaskRequestsValue>, TaskRequestsValue>(
  'task-requests',
  (res) => ({ requests: res.requests ?? [], canAssign: res.canAssign ?? false, members: res.members ?? [] }),
  { requests: [], canAssign: false, members: [] },
  // Re-check every couple of minutes so new requests show up without a reload
  2 * 60_000
);

export function useTaskRequests() {
  const { value, isLoading, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    store.ensureFresh();
  }, []);

  /** Assign a task to another member. Returns the assignee's name. */
  const assign = useCallback(async (input: { title: string; assigneeEmail: string; dueDate?: string }) => {
    const { assignee } = await apiFetch<{ assignee: string }>('task-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return assignee;
  }, []);

  /** Accept a request: it becomes a task on my to-do list. */
  const accept = useCallback(async (id: string) => {
    const { task } = await apiFetch<{ task: TaskDto }>(`task-requests?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ accept: true }),
    });
    store.update((v) => ({ ...v, requests: v.requests.filter((r) => r.id !== id) }));
    addTaskFromServer(task);
  }, []);

  return { ...value, isLoading, error, assign, accept, reload: store.reload };
}
