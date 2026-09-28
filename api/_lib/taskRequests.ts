// Task requests: the President, Vice President and Head of Tech can assign a
// task to another member. It waits in Team Dashboard > Task Requests until
// the assignee accepts it (there is no reject), and only then becomes a Tasks
// row with the assignee as PIC. Created by scripts/create-task-requests-database.mjs.

import type { PageObjectResponse } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { HttpError } from './http.js';
import { cacheInvalidate, dataSourceId, notion, queryAll, retrievePageIn } from './notion.js';
import { date, people, select, title, write } from './props.js';
import { loadTeam } from './team.js';
import { createTask } from './taskWrites.js';
import type { TaskDto } from './tasks.js';
import { getNotionUserIdForMemberEmail, notionUserIdFor } from './users.js';

/**
 * Notion ExCo `Position` values (or committee_members.role) that may assign
 * tasks to others, compared case-insensitively. "Tech Lead" is the same
 * person's title in Supabase.
 */
const ASSIGNER_ROLES = ['president', 'vice president', 'head of tech', 'tech lead'];

export interface TaskRequestDto {
  id: string;
  title: string;
  dueDate: string | null;
  /** Who assigned it, e.g. "Jane Doe". */
  requestedBy: string | null;
  requestedAt: string;
}

export interface AssignableMemberDto {
  email: string;
  name: string;
  role: string | null;
}

/** Today's date (YYYY-MM-DD) where the society is, not in UTC. */
function todayInMalaysia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
}

function normaliseRole(role: string | null | undefined): string {
  return (role ?? '').trim().toLowerCase();
}

/** The member's ExCo position from Notion, matched by committee email. */
async function notionPositionFor(member: CommitteeMember): Promise<string | null> {
  const emails = new Set([member.email, member.notionEmail].filter(Boolean));
  const row = (await loadTeam()).find((m) => m.email && emails.has(m.email.toLowerCase()));
  return row?.role ?? null;
}

export async function canAssignTasks(member: CommitteeMember): Promise<boolean> {
  if (ASSIGNER_ROLES.includes(normaliseRole(member.role))) return true;
  return ASSIGNER_ROLES.includes(normaliseRole(await notionPositionFor(member)));
}

async function requireAssigner(member: CommitteeMember) {
  if (!(await canAssignTasks(member))) {
    throw new HttpError(403, 'Only the President, Vice President and Head of Tech can assign tasks to others');
  }
}

/** Everyone else on the ExCo with a committee email, for the assignee dropdown. */
export async function assignableMembers(member: CommitteeMember): Promise<AssignableMemberDto[]> {
  const self = new Set([member.email, member.notionEmail].filter(Boolean));
  return (await loadTeam())
    .filter((m): m is typeof m & { email: string } => !!m.email && !self.has(m.email.toLowerCase()))
    .map((m) => ({ email: m.email, name: m.name, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function toRequest(page: PageObjectResponse): TaskRequestDto {
  return {
    id: page.id,
    title: title(page, 'Task') ?? 'Untitled task',
    dueDate: date(page, 'Due Date')?.start ?? null,
    requestedBy: people(page, 'Requested By')[0]?.name ?? null,
    requestedAt: page.created_time,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

/** Pending requests assigned to this member, oldest first. Never cached: they're checked on login. */
export async function pendingRequestsFor(member: CommitteeMember): Promise<TaskRequestDto[]> {
  const userId = await notionUserIdFor(member);
  if (!userId) return [];
  const pages = await queryAll(dataSourceId('taskRequests'), {
    filter: {
      and: [
        { property: 'Assigned To', people: { contains: userId } },
        { property: 'Status', select: { equals: 'Pending' } },
      ],
    },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  return pages.map(toRequest);
}

// ── Writes ───────────────────────────────────────────────────────────────────

export interface TaskRequestCreate {
  title?: unknown;
  dueDate?: unknown;
  assigneeEmail?: unknown;
}

function parseTitle(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, 'Task is required');
  if (text.length > 2000) throw new HttpError(400, 'Task must be 2000 characters or fewer');
  return text;
}

function parseDueDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new HttpError(400, 'Due date must be YYYY-MM-DD');
  }
  return value;
}

export async function createTaskRequest(member: CommitteeMember, input: TaskRequestCreate): Promise<{ assignee: string }> {
  await requireAssigner(member);
  const taskTitle = parseTitle(input.title);
  const dueDate = parseDueDate(input.dueDate);

  const email = typeof input.assigneeEmail === 'string' ? input.assigneeEmail.trim().toLowerCase() : '';
  const assignee = (await assignableMembers(member)).find((m) => m.email.toLowerCase() === email);
  if (!assignee) throw new HttpError(400, 'Pick a committee member to assign the task to');

  const [assigneeId, requesterId] = await Promise.all([getNotionUserIdForMemberEmail(assignee.email), notionUserIdFor(member)]);
  if (!assigneeId) {
    throw new HttpError(400, `${assignee.name} isn't linked to a Notion account yet, so they can't be given tasks. Ask an admin to set their Notion email.`);
  }

  await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('taskRequests') },
    properties: {
      Task: write.title(taskTitle),
      'Assigned To': write.people([assigneeId]),
      'Requested By': write.people(requesterId ? [requesterId] : []),
      'Due Date': write.date(dueDate),
      Status: write.select('Pending'),
    },
  });
  return { assignee: assignee.name };
}

/**
 * Accept a request: create the Tasks row (PIC = the acceptor) and mark the
 * request Accepted. Only the assignee can accept, and only once.
 */
export async function acceptTaskRequest(member: CommitteeMember, requestId: string): Promise<TaskDto> {
  const page = await retrievePageIn('taskRequests', requestId);
  if (!page) throw new HttpError(404, 'Task request not found');
  const userId = await notionUserIdFor(member);
  if (!userId || !people(page, 'Assigned To').some((p) => p.id === userId)) {
    throw new HttpError(403, 'This task request is for someone else');
  }
  if (select(page, 'Status') !== 'Pending') throw new HttpError(409, 'This task request was already accepted');

  const { task } = await createTask(member, {
    title: title(page, 'Task') ?? 'Untitled task',
    dueDate: date(page, 'Due Date')?.start ?? null,
  });
  await notion().pages.update({
    page_id: requestId,
    properties: {
      Status: write.select('Accepted'),
      'Accepted On': write.date(todayInMalaysia()),
      'Created Task': write.relation([task.id]),
    },
  });
  cacheInvalidate('tasks:');
  return task;
}
