import { format } from 'date-fns';
import { eventStart, parseDate, toOffsetDateTime } from '@/lib/eventDates';
import type { Event } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Form state for an event's date/time (EventWhenFields), shared by the add-
// and edit-event forms, and its conversion to Notion's Timeline start/end.
// ─────────────────────────────────────────────────────────────────────────────

/** The "When" part of the add-event and edit-event forms. */
export interface WhenValue {
  tba: boolean;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export const EMPTY_WHEN: WhenValue = { tba: false, allDay: false, startDate: '', startTime: '18:00', endDate: '', endTime: '' };

/** The form values for an existing event's date. */
export function whenFromEvent(event: Pick<Event, 'startDateTime' | 'endDateTime' | 'allDay'>): WhenValue {
  const start = eventStart(event);
  if (!start) return { ...EMPTY_WHEN, tba: true };
  const end = parseDate(event.endDateTime);
  const allDay = !!event.allDay;
  return {
    tba: false,
    allDay,
    startDate: format(start, 'yyyy-MM-dd'),
    startTime: allDay ? EMPTY_WHEN.startTime : format(start, 'HH:mm'),
    endDate: end && format(end, 'yyyy-MM-dd') !== format(start, 'yyyy-MM-dd') ? format(end, 'yyyy-MM-dd') : '',
    endTime: end && !allDay ? format(end, 'HH:mm') : '',
  };
}

/** Build Notion's start/end (null start = TBA), or an error message for the form. */
export function buildTimeline(v: WhenValue): { start: string | null; end: string | null } | string {
  if (v.tba) return { start: null, end: null };
  if (!v.startDate) return 'Pick a start date, or mark the date as TBA.';
  if (v.allDay) {
    if (v.endDate && v.endDate < v.startDate) return 'The end date is before the start date.';
    return { start: v.startDate, end: v.endDate && v.endDate !== v.startDate ? v.endDate : null };
  }
  if (!v.startTime) return 'Pick a start time, or tick "All day".';
  const start = toOffsetDateTime(v.startDate, v.startTime);
  // An end time with no end date means the same day
  if (!v.endTime && !v.endDate) return { start, end: null };
  if (!v.endTime) return 'Pick an end time too.';
  const end = toOffsetDateTime(v.endDate || v.startDate, v.endTime);
  if (Date.parse(end) <= Date.parse(start)) return 'The end is before the start.';
  return { start, end };
}
