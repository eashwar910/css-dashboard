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
// createEvent (POST) and saveEvent (PATCH) save to Notion. addEvent, rsvpEvent,
// removeEvent and updateEvent only change this in-memory copy, so the UI hides
// them (EVENT_FEATURES).
// ─────────────────────────────────────────────────────────────────────────────

type EventDto = EventsResponse['events'][number];

interface EventsResponse {
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

const store = createApiStore<EventsResponse, Event[]>('events', (res) => res.events.map(toEvent), []);

/** A new Notion event. start/end are ISO dates (all day) or datetimes with offset; no start = TBA. */
export interface NewEvent {
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  status: EventStatus;
}

/** Date/time and location edits. start null = TBA; send start and end together. */
export interface EventEdit {
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
  /** Add an event to the in-memory store (not saved to Notion). */
  addEvent: (event: Omit<Event, 'id'> & { id?: string }) => Event;
  /** Create an event in Notion and add it to the shared store. */
  createEvent: (input: NewEvent) => Promise<Event>;
  /** Save date/time and/or location to Notion and update the shared store. */
  saveEvent: (id: string, edit: EventEdit) => Promise<Event>;
  /** Increment the RSVP count in memory (not saved to Notion). */
  rsvpEvent: (id: string) => void;
  /** Remove an event from the in-memory store (not saved to Notion). */
  removeEvent: (id: string) => void;
  /** Alias for removeEvent */
  deleteEvent: (id: string) => void;
  /** Partial-update an event in the in-memory store (not saved to Notion). */
  updateEvent: (id: string, patch: Partial<Event>) => void;
}

export function useEvents(): EventsResult {
  const { value: rawData, isLoading, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    store.ensureFresh();
  }, []);

  const data = useMemo(() => [...rawData].sort(compareEvents), [rawData]);

  const addEvent = useCallback((newEvent: Omit<Event, 'id'> & { id?: string }): Event => {
    const event: Event = { ...newEvent, id: newEvent.id || `evt-${Date.now()}` };
    store.update((events) => [event, ...events]);
    return event;
  }, []);

  const createEvent = useCallback(async (input: NewEvent): Promise<Event> => {
    const { event: dto } = await apiFetch<{ event: EventDto }>('events', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const event = toEvent(dto);
    store.update((events) => [event, ...events]);
    return event;
  }, []);

  const saveEvent = useCallback(async (id: string, edit: EventEdit): Promise<Event> => {
    const { event: dto } = await apiFetch<{ event: EventDto }>(`events?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(edit),
    });
    const event = toEvent(dto);
    store.update((events) => events.map((e) => (e.id === id ? event : e)));
    return event;
  }, []);

  const rsvpEvent = useCallback((id: string) => {
    store.update((events) => events.map((e) => (e.id === id ? { ...e, rsvpCount: (e.rsvpCount || 0) + 1 } : e)));
  }, []);

  const removeEvent = useCallback((id: string) => {
    store.update((events) => events.filter((e) => e.id !== id));
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<Event>) => {
    store.update((events) => events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
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
    addEvent,
    createEvent,
    saveEvent,
    rsvpEvent,
    removeEvent,
    deleteEvent: removeEvent,
    updateEvent,
  };
}
