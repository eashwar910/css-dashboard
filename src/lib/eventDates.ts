import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import type { Event } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers for events and meetings. Every event date in the UI goes
// through these: dates are optional (TBA) and may be date-only (all day).
// ─────────────────────────────────────────────────────────────────────────────

/** Parse an ISO date/datetime, returning null for missing or invalid input. */
export function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function eventStart(event: Pick<Event, 'startDateTime'>): Date | null {
  return parseDate(event.startDateTime);
}

/** End of the event: its end date, else its start. All-day events end at the end of that day. */
export function eventEnd(event: Pick<Event, 'startDateTime' | 'endDateTime' | 'allDay'>): Date | null {
  const end = parseDate(event.endDateTime) ?? parseDate(event.startDateTime);
  if (!end) return null;
  return event.allDay ? endOfDay(end) : end;
}

export function isTba(event: Pick<Event, 'startDateTime'>): boolean {
  return eventStart(event) === null;
}

/** Not yet over. TBA events are not "upcoming" (they have no date). */
export function isUpcoming(event: Pick<Event, 'startDateTime' | 'endDateTime' | 'allDay'>, now = new Date()): boolean {
  const end = eventEnd(event);
  return end !== null && end >= (event.allDay ? startOfDay(now) : now);
}

/** Sort: dated events by start, then TBA events by title. */
export function compareEvents(a: Event, b: Event): number {
  const sa = eventStart(a);
  const sb = eventStart(b);
  if (sa && sb) return sa.getTime() - sb.getTime() || a.title.localeCompare(b.title);
  if (sa) return -1;
  if (sb) return 1;
  return a.title.localeCompare(b.title);
}

/** Format the start date, or 'Date TBA'. */
export function formatEventDate(event: Pick<Event, 'startDateTime'>, pattern: string): string {
  const start = eventStart(event);
  return start ? format(start, pattern) : 'Date TBA';
}

/** "6:00 PM – 7:30 PM", "6:00 PM", "All day", or "Time TBA". */
export function formatEventTimeRange(event: Pick<Event, 'startDateTime' | 'endDateTime' | 'allDay'>): string {
  const start = eventStart(event);
  if (!start) return 'Time TBA';
  if (event.allDay) return 'All day';
  const end = parseDate(event.endDateTime);
  return end ? `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}` : format(start, 'h:mm a');
}

/** Badge label: "Meeting" or "Event" (Notion has no event categories). */
export function eventKindLabel(event: Pick<Event, 'kind'>): string {
  return event.kind === 'meeting' ? 'Meeting' : 'Event';
}
