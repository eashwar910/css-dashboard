// Team Dashboard > Meetings → the Meetings tab. A meeting's minutes are its
// page body. Upcoming vs past is worked out from `Date` on the client; there's
// no status property to go stale. Organisers (roles.ts) add, edit and delete. Restructured by
// scripts/restructure-meetings-and-weeks.mjs. `Attendees` (people) is who's going: any
// committee member can add or remove themselves.

import type { PageObjectResponse } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { HttpError } from './http.js';
import { cacheInvalidate, cached, dataSourceId, notion, queryAll, retrievePageIn } from './notion.js';
import { dates } from './events.js';
import { date, people, select, title, write } from './props.js';
import { parseTimeline } from './eventWrites.js';
import { isOrganiser, ORGANISER_ONLY } from './roles.js';
import { getNotionUserIdForMemberEmail, notionUserIdFor } from './users.js';
import { loadTeam } from './team.js';

export interface MeetingDto {
  id: string;
  title: string;
  /** ISO date or datetime exactly as Notion returns it; null = date TBA. */
  start: string | null;
  end: string | null;
  allDay: boolean;
  location: string | null;
  /** `Type`: JC / ExCo / Weekly Meeting. */
  type: string | null;
  createdBy: string | null;
  /** `Attendees`: who's going (upcoming) or went (past). */
  attendees: AttendeeDto[];
  url: string;
}

export interface AttendeeDto {
  /** Notion user id. */
  id: string;
  name: string;
}

export function toMeeting(page: PageObjectResponse): MeetingDto {
  return {
    id: page.id,
    title: title(page, 'Name') ?? 'Untitled meeting',
    ...dates(date(page, 'Date')),
    location: select(page, 'Venue'),
    type: select(page, 'Type'),
    createdBy: people(page, 'Created By')[0]?.name ?? null,
    attendees: people(page, 'Attendees')
      .filter((p) => p.kind === 'person' || p.kind === 'unknown')
      .map((p) => ({ id: p.id, name: p.name ?? 'Former member' })),
    url: page.url,
  };
}

export async function meetingPages(): Promise<PageObjectResponse[]> {
  return cached('meetings:pages', () => queryAll(dataSourceId('meetings')));
}

export async function loadMeetings(): Promise<MeetingDto[]> {
  return (await meetingPages()).map(toMeeting);
}

/** A committee member (ExCo), for working out who isn't going. */
export interface RosterMemberDto {
  name: string;
  /** null when they have no Notion account we can match; then matched on name. */
  notionUserId: string | null;
}

/** The ExCo, each with their Notion user id where one can be found by email. */
export async function loadRoster(): Promise<RosterMemberDto[]> {
  const team = await loadTeam();
  return Promise.all(
    team.map(async (m) => ({ name: m.name, notionUserId: await getNotionUserIdForMemberEmail(m.email) })),
  );
}

// ── Attendance (any committee member, for themselves) ────────────────────────

/** Add the signed-in member to `Attendees` (going) or take them off it. */
export async function setAttendance(member: CommitteeMember, id: string, going: unknown): Promise<MeetingDto> {
  if (typeof going !== 'boolean') throw new HttpError(400, 'going must be true or false');
  const userId = await notionUserIdFor(member);
  if (!userId) throw new HttpError(409, "Your Notion account couldn't be found, so you can't be added as an attendee");

  // Read fresh so someone else's change a moment ago isn't overwritten
  const current = await retrievePageIn('meetings', id);
  if (!current) throw new HttpError(404, 'Meeting not found');
  const ids = people(current, 'Attendees').map((p) => p.id);
  if (going === ids.includes(userId)) return toMeeting(current);
  const next = going ? [...ids, userId] : ids.filter((x) => x !== userId);

  const page = await notion().pages.update({ page_id: id, properties: { Attendees: write.people(next) } });
  cacheInvalidate('meetings:');

  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the updated meeting');
  return toMeeting(page);
}

// ── Writes (organisers only: roles.ts) ───────────────────────────────────────

export interface MeetingCreate {
  title?: unknown;
  /** YYYY-MM-DD */
  date?: unknown;
  /** HH:mm, Malaysia time */
  time?: unknown;
  notes?: unknown;
  venue?: unknown;
  type?: unknown;
}

export interface MeetingEdit {
  title?: unknown;
  /** Same rules as an event's Timeline: null = TBA; send start and end together. */
  start?: unknown;
  end?: unknown;
  venue?: unknown;
  type?: unknown;
}

function parseTitle(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, 'Meeting title is required');
  if (text.length > 200) throw new HttpError(400, 'Meeting title must be 200 characters or fewer');
  return text;
}

/** "2026-10-01" + "18:30" → "2026-10-01T18:30:00+08:00". The society meets in Malaysia (UTC+8, no DST). */
function parseStart(dateValue: unknown, timeValue: unknown): string {
  if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(Date.parse(`${dateValue}T00:00:00Z`))) {
    throw new HttpError(400, 'Date must be YYYY-MM-DD');
  }
  if (typeof timeValue !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) {
    throw new HttpError(400, 'Time must be HH:mm');
  }
  return `${dateValue}T${timeValue}:00+08:00`;
}

function parseNotes(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpError(400, 'Notes must be text');
  if (value.length > 100_000) throw new HttpError(400, 'Notes are too long');
  return value.trim();
}

/** Venue is a Notion select: a new name becomes a new option. null clears it. */
function parseVenue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 100 || value.includes(',')) {
    throw new HttpError(400, 'Venue must be text of 100 characters or fewer, without commas');
  }
  return value.trim() || null;
}

/** Type must be one of the Notion options (JC / ExCo / Weekly Meeting). null clears it. */
function parseType(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !MEETING_TYPES.includes(value)) throw new HttpError(400, `Type must be one of: ${MEETING_TYPES.join(', ')}`);
  return value;
}

/** The Notion `Type` options, in Notion's order. */
export const MEETING_TYPES = ['JC', 'ExCo', 'Weekly Meeting'];

async function requireOrganiser(member: CommitteeMember) {
  if (!(await isOrganiser(member))) throw new HttpError(403, ORGANISER_ONLY);
}

/** Schedule a meeting. Notes become the page body. */
export async function createMeeting(member: CommitteeMember, input: MeetingCreate): Promise<MeetingDto> {
  await requireOrganiser(member);
  const name = parseTitle(input.title);
  const start = parseStart(input.date, input.time);
  const notes = parseNotes(input.notes);
  const venue = parseVenue(input.venue);
  const type = parseType(input.type);
  const creatorId = await notionUserIdFor(member);

  const page = await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('meetings') },
    properties: {
      Name: write.title(name),
      Date: write.date(start),
      Venue: write.select(venue),
      Type: write.select(type),
      'Created By': write.people(creatorId ? [creatorId] : []),
    },
    ...(notes ? { markdown: notes } : {}),
  });
  cacheInvalidate('meetings:');

  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the new meeting');
  return toMeeting(page);
}

/** Edit a meeting's title, date/time (or TBA), venue and/or type. */
export async function updateMeeting(member: CommitteeMember, id: string, edit: MeetingEdit): Promise<MeetingDto> {
  const properties: Record<string, ReturnType<(typeof write)[keyof typeof write]>> = {};
  if ('title' in edit) properties.Name = write.title(parseTitle(edit.title));
  if ('start' in edit || 'end' in edit) {
    const timeline = parseTimeline(edit.start, edit.end);
    properties.Date = write.date(timeline.start, timeline.end);
  }
  if ('venue' in edit) properties.Venue = write.select(parseVenue(edit.venue));
  if ('type' in edit) properties.Type = write.select(parseType(edit.type));
  if (!Object.keys(properties).length) throw new HttpError(400, 'Nothing to update');

  await requireOrganiser(member);
  if (!(await retrievePageIn('meetings', id))) throw new HttpError(404, 'Meeting not found');
  const page = await notion().pages.update({ page_id: id, properties });
  cacheInvalidate('meetings:');

  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the updated meeting');
  return toMeeting(page);
}

/** Move a meeting (and its minutes) to Notion's trash, restorable there for 30 days. */
export async function deleteMeeting(member: CommitteeMember, id: string): Promise<void> {
  await requireOrganiser(member);
  if (!(await retrievePageIn('meetings', id))) throw new HttpError(404, 'Meeting not found');
  await notion().pages.update({ page_id: id, in_trash: true });
  cacheInvalidate('meetings:');
}
