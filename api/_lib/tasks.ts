// Team Dashboard > Tasks → dashboard tasks and the weekly scrum view.
// Rules: docs/PLAN.md, "Tasks and weekly scrum to-dos".

import type { PageObjectResponse } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { eventPages } from './events.js';
import { canModifyTask } from './ownership.js';
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
  /** PIC has no individual person: only the "Everyone" group, or nobody. */
  shared: boolean;
  /** For shared tasks: "Everyone" or "Unassigned". null otherwise. */
  sharedWith: string | null;
  /** `Week`: Monday (YYYY-MM-DD, Kuala Lumpur) of the week the to-do was planned for; null if unset. */
  week: string | null;
  /** Individual PIC people, for grouping the Weekly tab by person. */
  assignees: { id: string; name: string }[];
  /** When the page was created in Notion: the "date added" for to-dos with no due date. */
  createdTime: string;
  /** In the Weekly tab's "This week": due (or added) this week or later. */
  thisWeek: boolean;
  /** In the Weekly tab's "Overdue": open and due (or added) before this week, or Done and from the two weeks before. */
  overdue: boolean;
  /** What the signed-in member may do (ownership.ts). The server re-checks on every write. */
  can: { toggle: boolean; edit: boolean; delete: boolean };
}

/** The member fields task mapping needs. */
export type TaskViewer = Pick<CommitteeMember, 'email' | 'notionEmail' | 'isAdmin'>;

const STATUS_MAP: Record<string, TaskStatusDto> = {
  'Not started': 'todo',
  'In progress': 'in-progress',
  Done: 'done',
};

// ── Week boundaries (Asia/Kuala_Lumpur, Monday start) ────────────────────────
// Malaysia is UTC+8 with no daylight saving, so a fixed offset is exact.

/**
 * Tasks belong to individuals. Groups and bots aren't owners; partial users
 * (id only) are a person we can't see, so they still count. Same rule as
 * ownership.ts. With no individual PIC, only Notion's "Everyone" group is
 * shown; any other group (e.g. a department) is ignored, so the task reads
 * as "Unassigned" until someone is named as PIC.
 */
export function sharedWith(page: PageObjectResponse): string | null {
  const pic = people(page, 'PIC');
  if (pic.some((p) => p.kind === 'person' || p.kind === 'unknown')) return null;
  return pic.some((p) => p.kind === 'group' && p.name === 'Everyone') ? 'Everyone' : 'Unassigned';
}

const KL_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday (YYYY-MM-DD) of the Kuala Lumpur week containing this instant. */
export function klMonday(at: Date): string {
  const kl = new Date(at.getTime() + KL_OFFSET_MS);
  const monday = Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth(), kl.getUTCDate()) - ((kl.getUTCDay() + 6) % 7) * DAY_MS;
  return new Date(monday).toISOString().slice(0, 10);
}

/** Kuala Lumpur calendar day (YYYY-MM-DD) of an ISO date or datetime. Date-only values are taken as written. */
function klDay(value: string): string {
  if (value.length <= 10) return value;
  return new Date(Date.parse(value) + KL_OFFSET_MS).toISOString().slice(0, 10);
}

/** Monday of the week a Notion `Week` value falls in (anyone may pick a non-Monday in Notion). */
function weekOf(value: string | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  const weekday = (new Date(ms).getUTCDay() + 6) % 7;
  return new Date(ms - weekday * DAY_MS).toISOString().slice(0, 10);
}

export function klWeek(now = new Date()): { start: Date; end: Date } {
  const kl = new Date(now.getTime() + KL_OFFSET_MS); // KL wall-clock time, read via UTC getters
  const daysSinceMonday = (kl.getUTCDay() + 6) % 7;
  const klMidnight = Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth(), kl.getUTCDate());
  const start = new Date(klMidnight - daysSinceMonday * DAY_MS - KL_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

// ── Mapping ──────────────────────────────────────────────────────────────────

/** Whether any PIC person on the task is this member (login email or notion_email). */
export function isMine(page: PageObjectResponse, member: Pick<TaskViewer, 'email' | 'notionEmail'>): boolean {
  const emails = new Set([member.email, member.notionEmail].filter((e): e is string => !!e).map((e) => e.toLowerCase()));
  return people(page, 'PIC').some((p) => p.email !== null && emails.has(p.email.toLowerCase()));
}

export function toTask(
  page: PageObjectResponse,
  member: TaskViewer,
  eventNames: Map<string, string>,
  week: { start: Date; end: Date },
): TaskDto {
  const notionStatus = status(page, 'Status');
  const taskStatus = (notionStatus && STATUS_MAP[notionStatus]) || 'todo';
  const eventIds = relationIds(page, 'Events');
  const mine = isMine(page, member);
  const shared = sharedWith(page);
  const thisMonday = klMonday(week.start);
  const twoWeeksAgo = klMonday(new Date(week.start.getTime() - 14 * DAY_MS));
  const taskWeek = weekOf(date(page, 'Week')?.start);
  const open = taskStatus !== 'done';
  const dueDate = date(page, 'Due Date')?.start ?? null;
  // The due date decides the column; with none, the day it was added does.
  const day = klDay(dueDate ?? page.created_time);
  const past = day < thisMonday;
  return {
    id: page.id,
    title: title(page, 'Task') ?? 'Untitled task',
    status: taskStatus,
    dueDate,
    eventIds,
    eventName: eventIds.map((id) => eventNames.get(id)).find((n): n is string => !!n) ?? null,
    lastEditedTime: page.last_edited_time,
    mine,
    shared: shared !== null,
    sharedWith: shared,
    week: taskWeek,
    assignees: people(page, 'PIC')
      .filter((p) => p.kind === 'person' || p.kind === 'unknown')
      .map((p) => ({ id: p.id, name: p.name ?? 'Former member' })),
    createdTime: page.created_time,
    thisWeek: !past,
    overdue: past && (open || day >= twoWeeksAgo),
    can: {
      toggle: canModifyTask(member, page, 'toggle').allowed,
      edit: canModifyTask(member, page, 'edit').allowed,
      delete: canModifyTask(member, page, 'delete').allowed,
    },
  };
}

/** Due date ascending; undated ones after, oldest added first; then title. */
function compareTasks(a: TaskDto, b: TaskDto): number {
  if (a.dueDate && b.dueDate) return Date.parse(a.dueDate) - Date.parse(b.dueDate) || a.title.localeCompare(b.title);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return Date.parse(a.createdTime) - Date.parse(b.createdTime) || a.title.localeCompare(b.title);
}

export async function taskPages(): Promise<PageObjectResponse[]> {
  return cached('tasks:pages', () => queryAll(dataSourceId('tasks')));
}

/** Event id → name (for project labels) and the current week, shared by reads and writes. */
export async function taskContext(now = new Date()) {
  const events = await eventPages();
  return {
    eventNames: new Map(events.map((e) => [e.id, title(e, 'Name') ?? 'Untitled event'])),
    week: klWeek(now),
  };
}

export async function loadTasks(member: TaskViewer, now = new Date()) {
  const [pages, { eventNames, week }] = await Promise.all([taskPages(), taskContext(now)]);
  return {
    tasks: pages.map((p) => toTask(p, member, eventNames, week)).sort(compareTasks),
    weekStart: week.start.toISOString(),
    weekEnd: week.end.toISOString(),
  };
}
