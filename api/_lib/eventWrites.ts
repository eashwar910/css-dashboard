// Event writes: create a row in Team Dashboard > Events.
// Events have no owner in Notion, so any committee member may create one.

import { HttpError } from './http.js';
import { cacheInvalidate, dataSourceId, notion } from './notion.js';
import { write } from './props.js';
import { toEvent, type CalendarItemDto, type EventStatusDto } from './events.js';

/** Dashboard status → exact Notion `Status` option. */
const NOTION_STATUS: Record<EventStatusDto, string> = {
  scheduled: 'Not started',
  'planning-in-progress': 'In progress',
  done: 'Done',
};

export interface EventCreate {
  title?: unknown;
  start?: unknown;
  end?: unknown;
  location?: unknown;
  status?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Datetime with an explicit offset, so Notion stores the right moment. */
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function parseTitle(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, 'Event name is required');
  if (text.length > 200) throw new HttpError(400, 'Event name must be 200 characters or fewer');
  return text;
}

function parseLocation(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 200) throw new HttpError(400, 'Location must be text of 200 characters or fewer');
  return value.trim() || null;
}

function parseStatus(value: unknown): EventStatusDto {
  if (value === undefined || value === null || value === '') return 'scheduled';
  if (value === 'scheduled' || value === 'planning-in-progress' || value === 'done') return value;
  throw new HttpError(400, "Status must be 'scheduled', 'planning-in-progress' or 'done'");
}

/**
 * start null = date TBA (end must be null too). Otherwise start and end must
 * both be dates (all day) or both datetimes with an offset, and end >= start.
 */
function parseTimeline(start: unknown, end: unknown): { start: string | null; end: string | null } {
  if (start === undefined || start === null || start === '') {
    if (end !== undefined && end !== null && end !== '') throw new HttpError(400, 'An end needs a start');
    return { start: null, end: null };
  }
  if (typeof start !== 'string') throw new HttpError(400, 'Start must be a date or datetime');
  const allDay = DATE_RE.test(start);
  if (!allDay && !DATETIME_RE.test(start)) throw new HttpError(400, 'Start must be YYYY-MM-DD or a datetime with a timezone offset');
  if (Number.isNaN(Date.parse(allDay ? `${start}T00:00:00Z` : start))) throw new HttpError(400, 'Start is not a real date');

  if (end === undefined || end === null || end === '') return { start, end: null };
  if (typeof end !== 'string' || !(allDay ? DATE_RE : DATETIME_RE).test(end)) {
    throw new HttpError(400, allDay ? 'End must be YYYY-MM-DD for an all-day event' : 'End must be a datetime with a timezone offset');
  }
  const startMs = Date.parse(allDay ? `${start}T00:00:00Z` : start);
  const endMs = Date.parse(allDay ? `${end}T00:00:00Z` : end);
  if (Number.isNaN(endMs)) throw new HttpError(400, 'End is not a real date');
  if (endMs < startMs) throw new HttpError(400, 'End must be after the start');
  return { start, end };
}

export async function createEvent(input: EventCreate): Promise<CalendarItemDto> {
  const title = parseTitle(input.title);
  const timeline = parseTimeline(input.start, input.end);
  const location = parseLocation(input.location);
  const status = parseStatus(input.status);

  const page = await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('events') },
    properties: {
      Name: write.title(title),
      Timeline: write.date(timeline.start, timeline.end),
      Location: write.richText(location),
      Status: write.status(NOTION_STATUS[status]),
    },
  });
  cacheInvalidate('events:');

  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the new event');
  return toEvent(page);
}
