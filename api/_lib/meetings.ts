// Team Dashboard > Meetings → the Meetings tab. A meeting's minutes are its
// page body. Upcoming vs past is worked out from `Date` on the client; there's
// no status property to go stale. Restructured by
// scripts/restructure-meetings-and-weeks.mjs.

import type { PageObjectResponse } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { HttpError } from './http.js';
import { cacheInvalidate, cached, dataSourceId, notion, queryAll } from './notion.js';
import { dates } from './events.js';
import { date, people, select, title, write } from './props.js';
import { hasAnyRole, MEETING_ORGANISER_ROLES } from './roles.js';
import { notionUserIdFor } from './users.js';

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
  url: string;
}

export function toMeeting(page: PageObjectResponse): MeetingDto {
  return {
    id: page.id,
    title: title(page, 'Name') ?? 'Untitled meeting',
    ...dates(date(page, 'Date')),
    location: select(page, 'Venue'),
    type: select(page, 'Type'),
    createdBy: people(page, 'Created By')[0]?.name ?? null,
    url: page.url,
  };
}

export async function meetingPages(): Promise<PageObjectResponse[]> {
  return cached('meetings:pages', () => queryAll(dataSourceId('meetings')));
}

export async function loadMeetings(): Promise<MeetingDto[]> {
  return (await meetingPages()).map(toMeeting);
}

export function canOrganiseMeetings(member: CommitteeMember): Promise<boolean> {
  return hasAnyRole(member, MEETING_ORGANISER_ROLES);
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface MeetingCreate {
  title?: unknown;
  /** YYYY-MM-DD */
  date?: unknown;
  /** HH:mm, Malaysia time */
  time?: unknown;
  notes?: unknown;
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
  if (value.length > 20_000) throw new HttpError(400, 'Notes must be 20,000 characters or fewer');
  return value.trim();
}

/** Schedule a meeting. President, Vice President, Secretary and Head of Tech only. */
export async function createMeeting(member: CommitteeMember, input: MeetingCreate): Promise<MeetingDto> {
  if (!(await canOrganiseMeetings(member))) {
    throw new HttpError(403, 'Only the President, Vice President, Secretary and Head of Tech can add meetings');
  }
  const name = parseTitle(input.title);
  const start = parseStart(input.date, input.time);
  const notes = parseNotes(input.notes);
  const creatorId = await notionUserIdFor(member);

  const page = await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('meetings') },
    properties: {
      Name: write.title(name),
      Date: write.date(start),
      'Created By': write.people(creatorId ? [creatorId] : []),
    },
    ...(notes ? { markdown: notes } : {}),
  });
  cacheInvalidate('meetings:');

  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the new meeting');
  return toMeeting(page);
}
