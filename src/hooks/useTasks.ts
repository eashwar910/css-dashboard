import { useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import type { AsyncResult, Task, TaskInput, TaskStatus } from '@/lib/types';
import { createApiStore } from '@/lib/apiStore';
import { apiFetch } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// useTasks
//
// Every task from /api/tasks (Notion Team Dashboard > Tasks), shared across
// views, plus the weekly scrum view and per-event lists. Writes go to the
// API; toggle and delete update optimistically and roll back on error.
// ─────────────────────────────────────────────────────────────────────────────

interface TaskDto {
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
  can: { toggle: boolean; edit: boolean; delete: boolean };
}

interface TasksResponse {
  tasks: TaskDto[];
  weekStart: string;
  weekEnd: string;
  notionLinked: boolean;
}

function toTask(t: TaskDto): Task {
  return {
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
    can: t.can,
  };
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
    tasks: res.tasks.map(toTask),
    weekStart: res.weekStart,
    weekEnd: res.weekEnd,
    notionLinked: res.notionLinked,
  }),
  { tasks: [], weekStart: null, weekEnd: null, notionLinked: true }
);

// ── Writes (module-level so every view shares them) ──────────────────────────

function replaceTask(task: Task) {
  store.update((v) => ({ ...v, tasks: v.tasks.map((t) => (t.id === task.id ? task : t)) }));
}

/** Tick/untick. Optimistic; rolls back and rethrows if the server refuses. */
async function setCompleted(id: string, completed: boolean): Promise<void> {
  const before = store.getSnapshot().value.tasks.find((t) => t.id === id);
  if (!before) return;
  replaceTask({ ...before, completed, status: completed ? 'done' : 'todo' });
  try {
    const { task } = await apiFetch<{ task: TaskDto }>(`tasks?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
    replaceTask(toTask(task));
  } catch (err) {
    replaceTask(before);
    throw err;
  }
}

/** Create a task (PIC = you). `warning` is set if it had to be created unassigned. */
async function createTask(input: TaskInput & { title: string }): Promise<{ task: Task; warning: string | null }> {
  const res = await apiFetch<{ task: TaskDto; warning: string | null }>('tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const task = toTask(res.task);
  store.update((v) => ({ ...v, tasks: [...v.tasks, task] }));
  return { task, warning: res.warning };
}

async function editTask(id: string, input: TaskInput): Promise<Task> {
  const { task } = await apiFetch<{ task: TaskDto }>(`tasks?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  const mapped = toTask(task);
  replaceTask(mapped);
  return mapped;
}

/** Move to Notion's trash. Optimistic; restores the task and rethrows on error. */
async function deleteTask(id: string): Promise<void> {
  const tasks = store.getSnapshot().value.tasks;
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return;
  const removed = tasks[index];
  store.update((v) => ({ ...v, tasks: v.tasks.filter((t) => t.id !== id) }));
  try {
    await apiFetch(`tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (err) {
    store.update((v) => {
      const next = [...v.tasks];
      next.splice(Math.min(index, next.length), 0, removed);
      return { ...v, tasks: next };
    });
    throw err;
  }
}

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
  /** Tick/untick (Done ↔ Not started), saved to Notion. Rejects after rolling back if refused. */
  toggleTask: (id: string) => Promise<void>;
  /** Create a task with you as PIC, optionally linked to an event. */
  createTask: (input: TaskInput & { title: string }) => Promise<{ task: Task; warning: string | null }>;
  /** Edit title, due date, status or event link. */
  editTask: (id: string, input: TaskInput) => Promise<Task>;
  /** Move a task to Notion's trash. */
  deleteTask: (id: string) => Promise<void>;
}

export function useTasks(): TasksResult {
  const { value, isLoading, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const data = value.tasks;

  useEffect(() => {
    store.ensureFresh();
  }, []);

  const toggleTask = useCallback((id: string) => {
    const task = store.getSnapshot().value.tasks.find((t) => t.id === id);
    return task ? setCompleted(id, !task.completed) : Promise.resolve();
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
    createTask,
    editTask,
    deleteTask,
  };
}
