// Task writes: tick/untick, create, edit and delete (in_trash).
// Every write re-reads the page fresh, checks ownership (ownership.ts) and
// clears the tasks cache afterwards. Rules: docs/PLAN.md "Ownership rules".

import { isFullPage } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { HttpError, normalisePageId } from './http.js';
import { cacheInvalidate, dataSourceId, notion, retrievePageIn } from './notion.js';
import { canModifyTask, type TaskAction } from './ownership.js';
import { date, write } from './props.js';
import { managesAllTasks } from './roles.js';
import { klMonday, taskContext, toTask, type TaskDto, type TaskStatusDto, type TaskViewer } from './tasks.js';
import { notionUserIdFor } from './users.js';

/** Dashboard status → exact Notion `Status` option (NOTION_MAPPING.md). */
const NOTION_STATUS: Record<TaskStatusDto, string> = {
  todo: 'Not started',
  'in-progress': 'In progress',
  done: 'Done',
};

// ── Validation ───────────────────────────────────────────────────────────────

function parseTitle(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, 'Title is required');
  if (text.length > 2000) throw new HttpError(400, 'Title must be 2000 characters or fewer');
  return text;
}

/** null clears the date. Accepts YYYY-MM-DD only. */
function parseDueDate(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new HttpError(400, 'Due date must be YYYY-MM-DD or null');
  }
  return value;
}

function parseStatus(value: unknown): TaskStatusDto {
  if (value === 'todo' || value === 'in-progress' || value === 'done') return value;
  throw new HttpError(400, "Status must be 'todo', 'in-progress' or 'done'");
}

/** null clears the link. The id must be a live row of Team Dashboard > Events. */
async function parseEventId(value: unknown): Promise<string | null> {
  if (value === null || value === '') return null;
  const id = normalisePageId(value);
  if (!id || !(await retrievePageIn('events', id))) throw new HttpError(400, 'Event not found');
  return id;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The member plus whether they may change anyone's task. */
async function viewerFor(member: CommitteeMember): Promise<TaskViewer> {
  return { ...member, managesAllTasks: await managesAllTasks(member) };
}

/** Fresh read + ownership check. Throws 404 or 403 (with the reason). */
async function authorise(member: CommitteeMember, taskId: string, action: TaskAction) {
  const [page, viewer] = await Promise.all([retrievePageIn('tasks', taskId), viewerFor(member)]);
  if (!page) throw new HttpError(404, 'Task not found');
  const decision = canModifyTask(viewer, page, action);
  if (!decision.allowed) throw new HttpError(403, decision.message, { reason: decision.reason });
  return page;
}

async function toDto(member: CommitteeMember, pageId: string): Promise<TaskDto> {
  const page = await retrievePageIn('tasks', pageId);
  if (!page) throw new HttpError(404, 'Task not found after update');
  const [{ eventNames, week }, viewer] = await Promise.all([taskContext(), viewerFor(member)]);
  return toTask(page, viewer, eventNames, week);
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Tick (Done) or untick (Not started). Allowed for owners, admins, and anyone
 * on shared tasks. Ticking a task with no `Week` files it under this week, so
 * it shows as done this week and last week once the week turns.
 */
export async function setTaskCompleted(member: CommitteeMember, taskId: string, completed: boolean): Promise<TaskDto> {
  // Event names are usually cached; load them while Notion does the write.
  const context = taskContext();
  const page = await authorise(member, taskId, 'toggle');
  const updated = await notion().pages.update({
    page_id: taskId,
    properties: {
      Status: write.status(NOTION_STATUS[completed ? 'done' : 'todo']),
      ...(completed && !date(page, 'Week') ? { Week: write.date(klMonday(new Date())) } : {}),
    },
  });
  cacheInvalidate('tasks:');
  // The update returns the page, so skip re-reading it when it's complete.
  if (!isFullPage(updated)) return toDto(member, taskId);
  const [{ eventNames, week }, viewer] = await Promise.all([context, viewerFor(member)]);
  return toTask(updated, viewer, eventNames, week);
}

export interface TaskEdit {
  title?: unknown;
  dueDate?: unknown;
  status?: unknown;
  eventId?: unknown;
}

/** Edit title, due date, status and/or event link. Owners and admins only. */
export async function editTask(member: CommitteeMember, taskId: string, edit: TaskEdit): Promise<TaskDto> {
  const properties: Record<string, ReturnType<(typeof write)[keyof typeof write]>> = {};
  if ('title' in edit) properties.Task = write.title(parseTitle(edit.title));
  if ('dueDate' in edit) properties['Due Date'] = write.date(parseDueDate(edit.dueDate));
  if ('status' in edit) properties.Status = write.status(NOTION_STATUS[parseStatus(edit.status)]);
  if ('eventId' in edit) {
    const eventId = await parseEventId(edit.eventId);
    properties.Events = write.relation(eventId ? [eventId] : []);
  }
  if (!Object.keys(properties).length) throw new HttpError(400, 'Nothing to update');

  await authorise(member, taskId, 'edit');
  await notion().pages.update({ page_id: taskId, properties });
  cacheInvalidate('tasks:');
  return toDto(member, taskId);
}

/** Move to Notion's trash. Owners and admins only. */
export async function deleteTask(member: CommitteeMember, taskId: string): Promise<void> {
  await authorise(member, taskId, 'delete');
  await notion().pages.update({ page_id: taskId, in_trash: true });
  cacheInvalidate('tasks:');
}

export interface TaskCreate extends TaskEdit {
  title: unknown;
}

/**
 * Create a task with PIC = the creator, Week = this week and, if given, a
 * link to its event.
 * If the creator has no Notion user, the task is created without a PIC
 * (so it's "Unassigned") and `warning` says so.
 */
export async function createTask(
  member: CommitteeMember,
  input: TaskCreate,
): Promise<{ task: TaskDto; warning: string | null }> {
  const title = parseTitle(input.title);
  const dueDate = 'dueDate' in input ? parseDueDate(input.dueDate) : null;
  const status = 'status' in input ? parseStatus(input.status) : 'todo';
  const eventId = 'eventId' in input ? await parseEventId(input.eventId) : null;
  const creatorId = await notionUserIdFor(member);

  const page = await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('tasks') },
    properties: {
      Task: write.title(title),
      Status: write.status(NOTION_STATUS[status]),
      'Due Date': write.date(dueDate),
      Events: write.relation(eventId ? [eventId] : []),
      PIC: write.people(creatorId ? [creatorId] : []),
      // Planned for the week it was added
      Week: write.date(klMonday(new Date())),
    },
  });
  cacheInvalidate('tasks:');

  return {
    task: await toDto(member, page.id),
    warning: creatorId
      ? null
      : "Your email doesn't match a Notion account, so the task was created without a PIC (Unassigned). Ask an admin to set your Notion email.",
  };
}
