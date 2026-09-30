import { useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import type { AsyncResult, Task, TaskInput, TaskStatus } from '@/lib/types';
import { createApiStore } from '@/lib/apiStore';
import { apiFetch } from '@/lib/api';
import { compareMembers } from '@/lib/memberOrder';

// ─────────────────────────────────────────────────────────────────────────────
// useTasks
//
// Every task from /api/tasks (Notion Team Dashboard > Tasks), shared across
// views, plus everyone's weekly to-dos (this week and overdue) and per-event
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
  createdTime: string;
  thisWeek: boolean;
  overdue: boolean;
  can: { toggle: boolean; edit: boolean; delete: boolean };
}

interface TasksResponse {
  tasks: TaskDto[];
  weekStart: string;
  weekEnd: string;
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
    createdTime: t.createdTime,
    thisWeek: t.thisWeek,
    overdue: t.overdue,
    can: t.can,
  };
}

interface TasksValue {
  tasks: Task[];
  weekStart: string | null;
  weekEnd: string | null;
  notionLinked: boolean;
  notionUserId: string | null;
}

const store = createApiStore<TasksResponse, TasksValue>(
  'tasks',
  (res) => ({
    tasks: res.tasks.map(toTask),
    weekStart: res.weekStart,
    weekEnd: res.weekEnd,
    notionLinked: res.notionLinked,
    notionUserId: res.notionUserId,
  }),
  { tasks: [], weekStart: null, weekEnd: null, notionLinked: true, notionUserId: null }
);

// ── Writes (module-level so every view shares them) ──────────────────────────

function replaceTask(task: Task) {
  store.update((v) => ({ ...v, tasks: v.tasks.map((t) => (t.id === task.id ? task : t)) }));
}

/** Ticks being saved: task id → the `completed` value the member wants. */
const saving = new Map<string, boolean>();

/** Show in-flight ticks over whatever the store holds, so a reload can't flip them back. */
function withSaving(task: Task): Task {
  const completed = saving.get(task.id);
  return completed === undefined ? task : { ...task, completed, status: completed ? 'done' : 'todo', saving: true };
}

/**
 * Tick/untick. Optimistic and instant; rolls back and rethrows if the server refuses.
 * One save per task at a time: clicks while one is in flight just change the
 * wanted value, and once the save lands it sends one more if that differs.
 */
async function setCompleted(id: string, completed: boolean): Promise<void> {
  const before = store.getSnapshot().value.tasks.find((t) => t.id === id);
  if (!before) return;
  const inFlight = saving.has(id);
  saving.set(id, completed);
  replaceTask({ ...before, completed, status: completed ? 'done' : 'todo' });
  if (inFlight) return;
  try {
    for (;;) {
      const sending = saving.get(id)!;
      const { task } = await apiFetch<{ task: TaskDto }>(`tasks?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: sending }),
      });
      if (saving.get(id) === sending) {
        saving.delete(id);
        replaceTask(toTask(task));
        return;
      }
    }
  } catch (err) {
    saving.delete(id);
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
  /** Notion user id. */
  key: string;
  name: string;
  /** The signed-in member's own group. */
  isMe: boolean;
  tasks: Task[];
}

/**
 * One group per PIC person (a task with several PICs appears under each),
 * in lib/memberOrder's order; anyone not listed there follows alphabetically.
 * Weekly to-dos are individual only, so tasks with no PIC person never get here.
 */
function groupByPerson(tasks: Task[], myUserId: string | null): PersonGroup[] {
  const people = new Map<string, PersonGroup>();
  for (const task of tasks) {
    for (const person of task.assignees) {
      const group = people.get(person.id) ?? { key: person.id, name: person.name, isMe: person.id === myUserId, tasks: [] };
      group.tasks.push(task);
      people.set(person.id, group);
    }
  }
  const byName = (a: PersonGroup, b: PersonGroup) => a.name.localeCompare(b.name);
  return [...people.values()].sort((a, b) => compareMembers(a.name, b.name) || byName(a, b));
}

/** Due date first, soonest first; undated after, oldest added first. Same order as the API. */
function compareWeekly(a: Task, b: Task): number {
  if (a.dueDate && b.dueDate) return Date.parse(a.dueDate) - Date.parse(b.dueDate) || a.title.localeCompare(b.title);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return Date.parse(a.createdTime) - Date.parse(b.createdTime) || a.title.localeCompare(b.title);
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
  /** Everyone's individual to-dos due (or added) this week or later. */
  thisWeek: Task[];
  /** Everyone's individual to-dos due (or added) before this week: open ones, and Done ones from the two weeks before. */
  overdue: Task[];
  /** thisWeek grouped by person. */
  thisWeekGroups: PersonGroup[];
  /** overdue grouped by person. */
  overdueGroups: PersonGroup[];
  /** Monday 00:00 (Kuala Lumpur) of this week, as an ISO instant. */
  weekStart: string | null;
  /** False when no Notion user matches the member's email (see committee_members.notion_email). */
  notionLinked: boolean;
  /** The signed-in member's Notion user id (a PersonGroup key), or null when not linked. */
  notionUserId: string | null;
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
  const data = useMemo(() => (saving.size ? value.tasks.map(withSaving) : value.tasks), [value.tasks]);

  useEffect(() => {
    store.ensureFresh();
  }, []);

  const toggleTask = useCallback((id: string) => {
    const task = store.getSnapshot().value.tasks.find((t) => t.id === id);
    return task ? setCompleted(id, !(saving.get(id) ?? task.completed)) : Promise.resolve();
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

  // Weekly is individual to-dos only: tasks for "Everyone" or nobody are left out.
  // Sorted here too, so tasks just added or edited land in place without a reload.
  const thisWeek = useMemo(() => data.filter((t) => t.thisWeek && t.assignees.length > 0).sort(compareWeekly), [data]);
  const overdue = useMemo(() => data.filter((t) => t.overdue && t.assignees.length > 0).sort(compareWeekly), [data]);
  const thisWeekGroups = useMemo(() => groupByPerson(thisWeek, value.notionUserId), [thisWeek, value.notionUserId]);
  const overdueGroups = useMemo(() => groupByPerson(overdue, value.notionUserId), [overdue, value.notionUserId]);

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
    overdue,
    thisWeekGroups,
    overdueGroups,
    weekStart: value.weekStart,
    notionLinked: value.notionLinked,
    notionUserId: value.notionUserId,
    forEvent,
    toggleTask,
    createTask,
    editTask,
    deleteTask,
  };
}
