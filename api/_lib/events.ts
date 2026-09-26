// Team Dashboard > Events and Team Dashboard > Meetings → calendar items.
// Meetings are not events: they get kind 'meeting' and no status.

import type { PageObjectResponse } from '@notionhq/client';
import { cached, dataSourceId, queryAll } from './notion.js';
import { date, richText, select, status, title, type DateValue } from './props.js';

export type EventStatusDto = 'scheduled' | 'planning-in-progress' | 'done';

export interface CalendarItemDto {
  id: string;
  kind: 'event' | 'meeting';
  title: string;
  /** ISO date or datetime exactly as Notion returns it; null = TBA. */
  start: string | null;
  end: string | null;
  /** Notion date without a time (e.g. "2026-09-30"). */
  allDay: boolean;
  location: string | null;
  /** Events only; null for meetings or an unrecognised Notion status. */
  status: EventStatusDto | null;
  /** The Notion page, for "Open in Notion" links. */
  url: string;
}

const STATUS_MAP: Record<string, EventStatusDto> = {
  'Not started': 'scheduled',
  'In progress': 'planning-in-progress',
  Done: 'done',
};

function dates(value: DateValue | null) {
  return {
    start: value?.start ?? null,
    end: value?.end ?? null,
    allDay: value ? !value.start.includes('T') : false,
  };
}

export function toEvent(page: PageObjectResponse): CalendarItemDto {
  const notionStatus = status(page, 'Status');
  return {
    id: page.id,
    kind: 'event',
    title: title(page, 'Name') ?? 'Untitled event',
    ...dates(date(page, 'Timeline')),
    location: richText(page, 'Location'),
    status: notionStatus ? STATUS_MAP[notionStatus] ?? null : null,
    url: page.url,
  };
}

export function toMeeting(page: PageObjectResponse): CalendarItemDto {
  return {
    id: page.id,
    kind: 'meeting',
    title: title(page, 'Task') ?? 'Untitled meeting',
    ...dates(date(page, 'Date')),
    location: select(page, 'Venue'),
    status: null,
    url: page.url,
  };
}

/** Dated items first (by start), then TBA items by title. */
export function compareCalendarItems(a: CalendarItemDto, b: CalendarItemDto): number {
  if (a.start && b.start) return Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title);
  if (a.start) return -1;
  if (b.start) return 1;
  return a.title.localeCompare(b.title);
}

export async function eventPages(): Promise<PageObjectResponse[]> {
  return cached('events:pages', () => queryAll(dataSourceId('events')));
}

export async function meetingPages(): Promise<PageObjectResponse[]> {
  return cached('meetings:pages', () => queryAll(dataSourceId('meetings')));
}

export async function loadCalendarItems(): Promise<CalendarItemDto[]> {
  const [events, meetings] = await Promise.all([eventPages(), meetingPages()]);
  return [...events.map(toEvent), ...meetings.map(toMeeting)].sort(compareCalendarItems);
}
