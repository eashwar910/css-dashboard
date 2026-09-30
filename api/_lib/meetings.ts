// Team Dashboard > Meetings → the Meetings tab. A meeting's minutes are its
// page body. Upcoming vs past is worked out from `Date` on the client; there's
// no status property to go stale. Organisers (roles.ts) add, edit and delete. Restructured by
// scripts/restructure-meetings-and-weeks.mjs. `Attendees` (people) is who's going and
// `Not Going` (people) who said they can't come: any committee member sets their own reply.
// `Attended` (people, scripts/add-meeting-attended.mjs) is who actually came, recorded by organisers.

import type { PageObjectResponse } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { HttpError } from './http.js';
import { cacheInvalidate, cached, dataSourceId, notion, queryAll, retrievePageIn } from './notion.js';
import { dates } from './events.js';
import { date, people, select, title, write } from './props.js';
import { parseTimeline } from './eventWrites.js';
import { isOrganiser, ORGANISER_ONLY } from './roles.js';
import { getNotionUserIdForMemberEmail, notionUserIdFor, userNamesById } from './users.js';
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
  /** `Not Going`: who said they can't come. */
  notGoing: AttendeeDto[];
  /** `Attended`: who actually came, recorded by organisers after the meeting. Empty = not recorded yet. */
  attended: AttendeeDto[];
  url: string;
}

export interface AttendeeDto {
  /** Notion user id. */
  id: string;
  name: string;
}

const NOT_GOING = 'Not Going';
const ATTENDED = 'Attended';

function individuals(page: PageObjectResponse, property: string): AttendeeDto[] {
  return people(page, property)
    .filter((p) => p.kind === 'person' || p.kind === 'unknown')
    .map((p) => ({ id: p.id, name: p.name ?? 'Former member' }));
}

export function toMeeting(page: PageObjectResponse): MeetingDto {
  return {
    id: page.id,
    title: title(page, 'Name') ?? 'Untitled meeting',
    ...dates(date(page, 'Date')),
    location: select(page, 'Venue'),
    type: select(page, 'Type'),
    createdBy: people(page, 'Created By')[0]?.name ?? null,
    attendees: individuals(page, 'Attendees'),
    notGoing: individuals(page, NOT_GOING),
    attended: individuals(page, ATTENDED),
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

/** Lowercase words of a name, ignoring dots and other punctuation. */
function nameWords(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * The ExCo, each with their Notion user id. Found by email first; members with
 * no committee email (so no match) fall back to the one Notion account nobody
 * else claimed whose name is made of words from theirs ("wen" → "Quek Jia Wen").
 * Without this they'd show twice on a meeting: under their Notion name and under No reply.
 */
export async function loadRoster(): Promise<RosterMemberDto[]> {
  const [team, names] = await Promise.all([loadTeam(), userNamesById()]);
  const roster = await Promise.all(
    team.map(async (m) => ({ name: m.name, notionUserId: await getNotionUserIdForMemberEmail(m.email) })),
  );
  const claimed = new Set(roster.map((r) => r.notionUserId).filter(Boolean));
  const unclaimed = [...names].filter(([id]) => !claimed.has(id));
  for (const member of roster) {
    if (member.notionUserId) continue;
    const words = new Set(nameWords(member.name));
    const matches = unclaimed.filter(([, name]) => {
      const theirs = nameWords(name);
      return theirs.length > 0 && theirs.every((w) => words.has(w));
    });
    if (matches.length === 1) member.notionUserId = matches[0][0];
  }
  return roster;
}

// ── Attendance (any committee member, for themselves) ────────────────────────

export type Rsvp = 'going' | 'not-going' | null;

/**
 * Set the signed-in member's reply: 'going' puts them in `Attendees`,
 * 'not-going' in `Not Going`, null takes them out of both.
 */
export async function setAttendance(member: CommitteeMember, id: string, rsvp: unknown): Promise<MeetingDto> {
  if (rsvp !== 'going' && rsvp !== 'not-going' && rsvp !== null) {
    throw new HttpError(400, "rsvp must be 'going', 'not-going' or null");
  }
  const userId = await notionUserIdFor(member);
  if (!userId) throw new HttpError(409, "Your Notion account couldn't be found, so you can't reply to meetings");

  // Read fresh so someone else's change a moment ago isn't overwritten
  const current = await retrievePageIn('meetings', id);
  if (!current) throw new HttpError(404, 'Meeting not found');
  const hasNotGoing = current.properties[NOT_GOING]?.type === 'people';
  if (rsvp === 'not-going' && !hasNotGoing) {
    throw new HttpError(409, `The Meetings database in Notion needs a "${NOT_GOING}" people property first`);
  }

  const withMe = (property: string, include: boolean) => {
    const ids = people(current, property).map((p) => p.id).filter((x) => x !== userId);
    return write.people(include ? [...ids, userId] : ids);
  };
  const properties: Record<string, ReturnType<typeof write.people>> = { Attendees: withMe('Attendees', rsvp === 'going') };
  if (hasNotGoing) properties[NOT_GOING] = withMe(NOT_GOING, rsvp === 'not-going');

  const page = await notion().pages.update({ page_id: id, properties });
  cacheInvalidate('meetings:');

  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the updated meeting');
  return toMeeting(page);
}

// ── Actual attendance (organisers only) ──────────────────────────────────────

/**
 * Replace who actually attended with these Notion user ids. Each must be a
 * committee member with a Notion account (the roster), so typos can't land.
 */
export async function setAttended(member: CommitteeMember, id: string, value: unknown): Promise<MeetingDto> {
  await requireOrganiser(member);
  if (!Array.isArray(value) || value.length > 100 || value.some((v) => typeof v !== 'string')) {
    throw new HttpError(400, 'attended must be a list of Notion user ids');
  }
  const known = new Set((await loadRoster()).map((r) => r.notionUserId).filter((x): x is string => !!x));
  const ids = [...new Set(value as string[])];
  if (ids.some((x) => !known.has(x))) throw new HttpError(400, 'Everyone marked as attended must be on the committee list with a Notion account');

  const current = await retrievePageIn('meetings', id);
  if (!current) throw new HttpError(404, 'Meeting not found');
  if (current.properties[ATTENDED]?.type !== 'people') {
    throw new HttpError(409, `The Meetings database in Notion needs an "${ATTENDED}" people property first`);
  }
  const page = await notion().pages.update({ page_id: id, properties: { [ATTENDED]: write.people(ids) } });
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
