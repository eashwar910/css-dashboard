// Team Dashboard > Tasks → dashboard tasks and the weekly scrum view.
// Rules: docs/PLAN.md, "Tasks and weekly scrum to-dos".

import type { PageObjectResponse } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { eventPages } from './events.js';
import { cached, dataSourceId, queryAll } from './notion.js';
import { date, people, relationIds, status, title } from './props.js';

export type TaskStatusDto = 'todo' | 'in-progress' | 'done';

export interface TaskDto {
  id: string;
  title: string;
  status: TaskStatusDto;
  /** ISO date or datetime from `Due Date`; null when unset. */
  dueDate: string | null;
  /** Linked Team Dashboard > Events page ids (`Events` relation). */
  eventIds: string[];
  /** Name of the first linked event: the task's project label. null = "General". */
  eventName: string | null;
  lastEditedTime: string;
  /** A PIC person's email matches the signed-in member's login or notion_email. */
  mine: boolean;
  /**
   * PIC has no individual person: only groups (e.g. "Everyone") or nobody.
   * Shown to every member under "Shared" in the weekly view.
   */
  shared: boolean;
  /** For shared tasks: the PIC group name(s), or "Unassigned". null otherwise. */
  sharedWith: string | null;
  /** Shown in the weekly scrum view: mine or shared, and not Done or Done this week. */
  weekly: boolean;
}

const STATUS_MAP: Record<string, TaskStatusDto> = {
  'Not started': 'todo',
  'In progress': 'in-progress',
  Done: 'done',
};

// ── Week boundaries (Asia/Kuala_Lumpur, Monday start) ────────────────────────
// Malaysia is UTC+8 with no daylight saving, so a fixed offset is exact.

/**
 * Groups and bots aren't individual owners; partial users (id only) are a
 * person we can't see, so they still count. Same rule as ownership.ts.
 */
export function sharedWith(page: PageObjectResponse): string | null {
  const pic = people(page, 'PIC');
  if (pic.some((p) => p.kind === 'person' || p.kind === 'unknown')) return null;
  const groups = pic.filter((p) => p.kind === 'group').map((p) => p.name ?? 'Group');
  return groups.length ? groups.join(', ') : 'Unassigned';
}

const KL_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function klWeek(now = new Date()): { start: Date; end: Date } {
  const kl = new Date(now.getTime() + KL_OFFSET_MS); // KL wall-clock time, read via UTC getters
  const daysSinceMonday = (kl.getUTCDay() + 6) % 7;
  const klMidnight = Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth(), kl.getUTCDate());
  const start = new Date(klMidnight - daysSinceMonday * DAY_MS - KL_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

// ── Mapping ──────────────────────────────────────────────────────────────────

/** Whether any PIC person on the task is this member (login email or notion_email). */
export function isMine(page: PageObjectResponse, member: Pick<CommitteeMember, 'email' | 'notionEmail'>): boolean {
  const emails = new Set([member.email, member.notionEmail].filter((e): e is string => !!e).map((e) => e.toLowerCase()));
  return people(page, 'PIC').some((p) => p.email !== null && emails.has(p.email.toLowerCase()));
}

export function toTask(
  page: PageObjectResponse,
  member: Pick<CommitteeMember, 'email' | 'notionEmail'>,
  eventNames: Map<string, string>,
  week: { start: Date; end: Date },
): TaskDto {
  const notionStatus = status(page, 'Status');
  const taskStatus = (notionStatus && STATUS_MAP[notionStatus]) || 'todo';
  const eventIds = relationIds(page, 'Events');
  const mine = isMine(page, member);
  const shared = sharedWith(page);
  const edited = Date.parse(page.last_edited_time);
  const doneThisWeek = taskStatus === 'done' && edited >= week.start.getTime() && edited < week.end.getTime();
  return {
    id: page.id,
    title: title(page, 'Task') ?? 'Untitled task',
    status: taskStatus,
    dueDate: date(page, 'Due Date')?.start ?? null,
    eventIds,
    eventName: eventIds.map((id) => eventNames.get(id)).find((n): n is string => !!n) ?? null,
    lastEditedTime: page.last_edited_time,
    mine,
    shared: shared !== null,
    sharedWith: shared,
    weekly: (mine || shared !== null) && (taskStatus !== 'done' || doneThisWeek),
  };
}

/** Due date ascending (undated last), then title. */
function compareTasks(a: TaskDto, b: TaskDto): number {
  if (a.dueDate && b.dueDate) return Date.parse(a.dueDate) - Date.parse(b.dueDate) || a.title.localeCompare(b.title);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.title.localeCompare(b.title);
}

export async function taskPages(): Promise<PageObjectResponse[]> {
  return cached('tasks:pages', () => queryAll(dataSourceId('tasks')));
}

export async function loadTasks(member: Pick<CommitteeMember, 'email' | 'notionEmail'>, now = new Date()) {
  const [pages, events] = await Promise.all([taskPages(), eventPages()]);
  const eventNames = new Map(events.map((e) => [e.id, title(e, 'Name') ?? 'Untitled event']));
  const week = klWeek(now);
  return {
    tasks: pages.map((p) => toTask(p, member, eventNames, week)).sort(compareTasks),
    weekStart: week.start.toISOString(),
    weekEnd: week.end.toISOString(),
  };
}
