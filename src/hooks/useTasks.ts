import { useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import type { AsyncResult, Task, TaskInput, TaskStatus } from '@/lib/types';
import { createApiStore } from '@/lib/apiStore';
import { apiFetch } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// useTasks
//
// Every task from /api/tasks (Notion Team Dashboard > Tasks), shared across
// views, plus everyone's weekly to-dos (this week and last) and per-event
// lists. Writes go to the API; toggle and delete update optimistically and
// roll back on error.
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskDto {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  eventIds: string[];
  eventName: string | null;
  mine: boolean;
  shared: boolean;
  sharedWith: string | null;
  week: string | null;
  assignees: { id: string; name: string }[];
  thisWeek: boolean;
  carriedOver: boolean;
  lastWeek: boolean;
  can: { toggle: boolean; edit: boolean; delete: boolean };
}

interface TasksResponse {
  tasks: TaskDto[];
  weekStart: string;
  weekEnd: string;
  lastWeekStart: string;
  notionLinked: boolean;
  notionUserId: string | null;
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
    week: t.week ?? undefined,
    assignees: t.assignees,
    thisWeek: t.thisWeek,
    carriedOver: t.carriedOver,
    lastWeek: t.lastWeek,
    can: t.can,
  };
}

interface TasksValue {
  tasks: Task[];
  weekStart: string | null;
  weekEnd: string | null;
  lastWeekStart: string | null;
  notionLinked: boolean;
  notionUserId: string | null;
}

const store = createApiStore<TasksResponse, TasksValue>(
  'tasks',
  (res) => ({
    tasks: res.tasks.map(toTask),
    weekStart: res.weekStart,
    weekEnd: res.weekEnd,
    lastWeekStart: res.lastWeekStart,
    notionLinked: res.notionLinked,
    notionUserId: res.notionUserId,
  }),
  { tasks: [], weekStart: null, weekEnd: null, lastWeekStart: null, notionLinked: true, notionUserId: null }
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

/** Add a task the server just created elsewhere (e.g. an accepted task request). */
export function addTaskFromServer(dto: TaskDto): void {
  const task = toTask(dto);
  store.update((v) => ({ ...v, tasks: [...v.tasks.filter((t) => t.id !== task.id), task] }));
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

/** byProject label for tasks with no linked event. */
export const GENERAL_GROUP = 'General';

export interface PersonGroup {
  /** Notion user id, or 'group:Everyone' / 'group:Unassigned'. */
  key: string;
  name: string;
  /** The signed-in member's own group. */
  isMe: boolean;
  tasks: Task[];
}

/**
 * One group per PIC person (a task with several PICs appears under each),
 * then "Everyone" (Notion's Everyone group), then "Unassigned".
 * The signed-in member's group comes first; the rest are alphabetical.
 */
function groupByPerson(tasks: Task[], myUserId: string | null): PersonGroup[] {
  const people = new Map<string, PersonGroup>();
  const teams = new Map<string, PersonGroup>();
  for (const task of tasks) {
    if (task.assignees.length) {
      for (const person of task.assignees) {
        const group = people.get(person.id) ?? { key: person.id, name: person.name, isMe: person.id === myUserId, tasks: [] };
        group.tasks.push(task);
        people.set(person.id, group);
      }
      continue;
    }
    const name = task.sharedWith ?? 'Unassigned';
    const group = teams.get(name) ?? { key: `group:${name}`, name, isMe: false, tasks: [] };
    group.tasks.push(task);
    teams.set(name, group);
  }
  const byName = (a: PersonGroup, b: PersonGroup) => a.name.localeCompare(b.name);
  const ordered = [...people.values()].sort((a, b) => Number(b.isMe) - Number(a.isMe) || byName(a, b));
  const groups = [...teams.values()].sort((a, b) => Number(a.name === 'Unassigned') - Number(b.name === 'Unassigned') || byName(a, b));
  return [...ordered, ...groups];
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
  /** Everyone's to-dos for this week (planned this week, or still open). */
  thisWeek: Task[];
  /** Everyone's to-dos planned for last week, Done or not. */
  lastWeek: Task[];
  /** thisWeek grouped by person (you first). */
  thisWeekGroups: PersonGroup[];
  /** lastWeek grouped by person (you first). */
  lastWeekGroups: PersonGroup[];
  /** Monday 00:00 (Kuala Lumpur) of this week and last week, as ISO instants. */
  weekStart: string | null;
  lastWeekStart: string | null;
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

  const thisWeek = useMemo(() => data.filter((t) => t.thisWeek), [data]);
  const lastWeek = useMemo(() => data.filter((t) => t.lastWeek), [data]);
  const thisWeekGroups = useMemo(() => groupByPerson(thisWeek, value.notionUserId), [thisWeek, value.notionUserId]);
  const lastWeekGroups = useMemo(() => groupByPerson(lastWeek, value.notionUserId), [lastWeek, value.notionUserId]);

  const forEvent = useCallback((eventId: string) => data.filter((t) => t.eventIds.includes(eventId)), [data]);

  return {
    data,
    isLoading,
    error,
    byProject,
    byStatus,
    completedCount,
    totalCount: data.length,
    thisWeek,
    lastWeek,
    thisWeekGroups,
    lastWeekGroups,
    weekStart: value.weekStart,
    lastWeekStart: value.lastWeekStart,
    notionLinked: value.notionLinked,
    forEvent,
    toggleTask,
    createTask,
    editTask,
    deleteTask,
  };
}
