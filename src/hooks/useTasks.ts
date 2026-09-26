import { useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import type { AsyncResult, Task, TaskStatus } from '@/lib/types';
import { createApiStore } from '@/lib/apiStore';

// ─────────────────────────────────────────────────────────────────────────────
// useTasks
//
// Every task from GET /api/tasks (Notion Team Dashboard > Tasks), shared
// across views, plus the weekly scrum view and per-event lists.
// toggleTask only changes this in-memory copy until task writes exist.
// ─────────────────────────────────────────────────────────────────────────────

interface TasksResponse {
  tasks: {
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: string | null;
    eventIds: string[];
    eventName: string | null;
    mine: boolean;
    shared: boolean;
    sharedWith: string | null;
    weekly: boolean;
  }[];
  weekStart: string;
  weekEnd: string;
  notionLinked: boolean;
}

interface TasksValue {
  tasks: Task[];
  weekStart: string | null;
  weekEnd: string | null;
  notionLinked: boolean;
}

const store = createApiStore<TasksResponse, TasksValue>(
  'tasks',
  (res) => ({
    tasks: res.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      completed: t.status === 'done',
      project: t.eventName ?? undefined,
      dueDate: t.dueDate ?? undefined,
      eventIds: t.eventIds,
      mine: t.mine,
      shared: t.shared,
      sharedWith: t.sharedWith ?? undefined,
      weekly: t.weekly,
    })),
    weekStart: res.weekStart,
    weekEnd: res.weekEnd,
    notionLinked: res.notionLinked,
  }),
  { tasks: [], weekStart: null, weekEnd: null, notionLinked: true }
);

/** Label for the member's own tasks with no linked event in the weekly view. */
export const GENERAL_GROUP = 'General';
/** Label for group-assigned and unassigned tasks in the weekly view. */
export const SHARED_GROUP = 'Shared';

export interface WeeklyGroup {
  /** Stable key: event page id, 'general' or 'shared'. */
  key: string;
  /** Event page id for event groups; null for "General" and "Shared". */
  eventId: string | null;
  name: string;
  tasks: Task[];
}

export interface TasksResult extends AsyncResult<Task[]> {
  /** Tasks grouped by their `project` (linked event name); unlinked tasks under "General". */
  byProject: Record<string, Task[]>;
  /** Tasks grouped by their `status` field. */
  byStatus: Record<TaskStatus, Task[]>;
  /** Count of completed tasks. */
  completedCount: number;
  /** Total task count. */
  totalCount: number;
  /** The signed-in member's weekly scrum to-dos. */
  weekly: Task[];
  /** Weekly to-dos: the member's own grouped by linked event (alphabetical), then "General", then "Shared". */
  weeklyGroups: WeeklyGroup[];
  /** False when no Notion user matches the member's email (see committee_members.notion_email). */
  notionLinked: boolean;
  /** All tasks linked to an event (the event detail to-do list). */
  forEvent: (eventId: string) => Task[];
  /** Tick/untick locally (not saved to Notion yet). Done ↔ Not started. */
  toggleTask: (id: string) => void;
}

export function useTasks(): TasksResult {
  const { value, isLoading, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const data = value.tasks;

  useEffect(() => {
    store.ensureFresh();
  }, []);

  const toggleTask = useCallback((id: string) => {
    store.update((v) => ({
      ...v,
      tasks: v.tasks.map((t) =>
        t.id === id ? { ...t, completed: !t.completed, status: t.completed ? 'todo' : 'done' } : t
      ),
    }));
  }, []);

  const byProject = useMemo<Record<string, Task[]>>(() => {
    return data.reduce<Record<string, Task[]>>((acc, task) => {
      const key = task.project ?? GENERAL_GROUP;
      (acc[key] ??= []).push(task);
      return acc;
    }, {});
  }, [data]);

  const byStatus = useMemo<Record<TaskStatus, Task[]>>(() => {
    const base: Record<TaskStatus, Task[]> = { todo: [], 'in-progress': [], done: [] };
    return data.reduce((acc, task) => {
      acc[task.status].push(task);
      return acc;
    }, base);
  }, [data]);

  const completedCount = useMemo(() => data.filter((t) => t.completed).length, [data]);

  const weekly = useMemo(() => data.filter((t) => t.weekly), [data]);

  const weeklyGroups = useMemo<WeeklyGroup[]>(() => {
    const events = new Map<string, WeeklyGroup>();
    const general: WeeklyGroup = { key: 'general', eventId: null, name: GENERAL_GROUP, tasks: [] };
    const shared: WeeklyGroup = { key: 'shared', eventId: null, name: SHARED_GROUP, tasks: [] };
    for (const task of weekly) {
      // A task that's both mine and shared can't happen: shared means no individual PIC.
      if (task.shared) {
        shared.tasks.push(task);
        continue;
      }
      const eventId = task.project ? task.eventIds[0] : undefined;
      if (!eventId) {
        general.tasks.push(task);
        continue;
      }
      const group = events.get(eventId) ?? { key: eventId, eventId, name: task.project!, tasks: [] };
      group.tasks.push(task);
      events.set(eventId, group);
    }
    return [
      ...[...events.values()].sort((a, b) => a.name.localeCompare(b.name)),
      general,
      shared,
    ].filter((g) => g.tasks.length > 0);
  }, [weekly]);

  const forEvent = useCallback((eventId: string) => data.filter((t) => t.eventIds.includes(eventId)), [data]);

  return {
    data,
    isLoading,
    error,
    byProject,
    byStatus,
    completedCount,
    totalCount: data.length,
    weekly,
    weeklyGroups,
    notionLinked: value.notionLinked,
    forEvent,
    toggleTask,
  };
}
