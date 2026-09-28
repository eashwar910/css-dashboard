import { useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import { isSameMonth } from 'date-fns';
import type { AsyncResult, Event, EventCategory, EventStatus } from '@/lib/types';
import { createApiStore } from '@/lib/apiStore';
import { compareEvents, eventStart, isTba, isUpcoming } from '@/lib/eventDates';
import { apiFetch } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Shared event store
//
// Single source of truth across views (Calendar & Events, Home, search),
// loaded from GET /api/events (Notion Events only; meetings are useMeetings).
// createEvent, saveEvent and deleteEvent save to Notion. rsvpEvent only
// changes this in-memory copy, so the UI hides it (EVENT_FEATURES.rsvp).
// ─────────────────────────────────────────────────────────────────────────────

type EventDto = EventsResponse['events'][number];

interface EventsResponse {
  /** Organisers may delete events. */
  canDelete: boolean;
  events: {
    id: string;
    title: string;
    start: string | null;
    end: string | null;
    allDay: boolean;
    location: string | null;
    status: EventStatus | null;
    url: string;
  }[];
}

function toEvent(dto: EventDto): Event {
  return {
    id: dto.id,
    title: dto.title,
    description: '',
    startDateTime: dto.start ?? undefined,
    endDateTime: dto.end ?? undefined,
    allDay: dto.allDay,
    location: dto.location ?? undefined,
    category: 'other',
    agenda: [],
    rsvpCount: 0,
    status: dto.status ?? undefined,
    notionUrl: dto.url,
    todos: [],
    financeItems: [],
  };
}

const store = createApiStore<EventsResponse, { events: Event[]; canDelete: boolean }>(
  'events',
  (res) => ({ events: res.events.map(toEvent), canDelete: res.canDelete }),
  { events: [], canDelete: false }
);

function updateEvents(fn: (events: Event[]) => Event[]) {
  store.update((v) => ({ ...v, events: fn(v.events) }));
}

/** A new Notion event. start/end are ISO dates (all day) or datetimes with offset; no start = TBA. */
export interface NewEvent {
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  status: EventStatus;
}

/** Event edits. start null = TBA; send start and end together. */
export interface EventEdit {
  title?: string;
  status?: EventStatus;
  start?: string | null;
  end?: string | null;
  location?: string | null;
}

export interface EventsResult extends AsyncResult<Event[]> {
  /** Dated events that aren't over yet (sorted ascending). */
  upcoming: Event[];
  /** Events with no date yet ("TBA"), sorted by title. */
  tba: Event[];
  /** Dated events starting within the given month. TBA events are never included. */
  forMonth: (year: number, month: number) => Event[];
  /** Events grouped by category (always 'other': Notion has no category). */
  byCategory: Record<EventCategory, Event[]>;
  /** Create an event in Notion and add it to the shared store. */
  createEvent: (input: NewEvent) => Promise<Event>;
  /** Save title, status, date/time and/or location to Notion. */
  saveEvent: (id: string, edit: EventEdit) => Promise<Event>;
  /** Increment the RSVP count in memory (not saved to Notion). */
  rsvpEvent: (id: string) => void;
  /** Move an event to Notion's trash (organisers only). */
  deleteEvent: (id: string) => Promise<void>;
  /** The signed-in member is an organiser and may delete events. */
  canDelete: boolean;
}

export function useEvents(): EventsResult {
  const { value, isLoading, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const rawData = value.events;

  useEffect(() => {
    store.ensureFresh();
  }, []);

  const data = useMemo(() => [...rawData].sort(compareEvents), [rawData]);

  const createEvent = useCallback(async (input: NewEvent): Promise<Event> => {
    const { event: dto } = await apiFetch<{ event: EventDto }>('events', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const event = toEvent(dto);
    updateEvents((events) => [event, ...events]);
    return event;
  }, []);

  const saveEvent = useCallback(async (id: string, edit: EventEdit): Promise<Event> => {
    const { event: dto } = await apiFetch<{ event: EventDto }>(`events?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(edit),
    });
    const event = toEvent(dto);
    updateEvents((events) => events.map((e) => (e.id === id ? event : e)));
    return event;
  }, []);

  const rsvpEvent = useCallback((id: string) => {
    updateEvents((events) => events.map((e) => (e.id === id ? { ...e, rsvpCount: (e.rsvpCount || 0) + 1 } : e)));
  }, []);

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    await apiFetch(`events?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    updateEvents((events) => events.filter((e) => e.id !== id));
  }, []);

  const upcoming = useMemo(() => data.filter((e) => isUpcoming(e)), [data]);
  const tba = useMemo(() => data.filter(isTba), [data]);

  const forMonth = useMemo(
    () =>
      (year: number, month: number): Event[] => {
        const ref = new Date(year, month, 1);
        return data.filter((e) => {
          const start = eventStart(e);
          return start !== null && isSameMonth(start, ref);
        });
      },
    [data]
  );

  const byCategory = useMemo<Record<EventCategory, Event[]>>(() => {
    const base: Record<EventCategory, Event[]> = {
      workshop: [],
      social: [],
      meeting: [],
      talk: [],
      hackathon: [],
      other: [],
    };
    return data.reduce((acc, event) => {
      acc[event.category].push(event);
      return acc;
    }, base);
  }, [data]);

  return {
    data,
    isLoading,
    error,
    upcoming,
    tba,
    forMonth,
    byCategory,
    createEvent,
    saveEvent,
    rsvpEvent,
    deleteEvent,
    canDelete: value.canDelete,
  };
}
