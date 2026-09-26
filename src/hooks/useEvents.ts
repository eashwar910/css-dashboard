import { useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import { isSameMonth } from 'date-fns';
import type { AsyncResult, Event, EventCategory, EventStatus } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { compareEvents, eventStart, isTba, isUpcoming } from '@/lib/eventDates';

// ─────────────────────────────────────────────────────────────────────────────
// Shared event store
//
// Single source of truth across views (Calendar & Events, Home, search),
// loaded from GET /api/events (Notion Events + Meetings). The mutation
// functions only change this in-memory copy; there is no event write
// endpoint, so the UI hides them (EVENT_FEATURES.editing).
// ─────────────────────────────────────────────────────────────────────────────

interface EventsResponse {
  events: {
    id: string;
    kind: 'event' | 'meeting';
    title: string;
    start: string | null;
    end: string | null;
    allDay: boolean;
    location: string | null;
    status: EventStatus | null;
    url: string;
  }[];
}

interface EventsState {
  events: Event[];
  isLoading: boolean;
  error: Error | null;
  loadedAt: number;
}

const RELOAD_AFTER_MS = 60_000;

let state: EventsState = { events: [], isLoading: true, error: null, loadedAt: 0 };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<EventsState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): EventsState {
  return state;
}

function toEvent(dto: EventsResponse['events'][number]): Event {
  return {
    id: dto.id,
    kind: dto.kind,
    title: dto.title,
    description: '',
    startDateTime: dto.start ?? undefined,
    endDateTime: dto.end ?? undefined,
    allDay: dto.allDay,
    location: dto.location ?? undefined,
    category: dto.kind === 'meeting' ? 'meeting' : 'other',
    agenda: [],
    rsvpCount: 0,
    status: dto.status ?? undefined,
    notionUrl: dto.url,
    todos: [],
    financeItems: [],
  };
}

function loadEvents(): Promise<void> {
  inflight ??= apiFetch<EventsResponse>('events')
    .then((res) => setState({ events: res.events.map(toEvent), error: null, loadedAt: Date.now() }))
    .catch((err: unknown) => {
      console.error('Failed to load /api/events', err);
      setState({ error: err instanceof Error ? err : new Error(String(err)) });
    })
    .finally(() => {
      inflight = null;
      setState({ isLoading: false });
    });
  return inflight;
}

export interface EventsResult extends AsyncResult<Event[]> {
  /** Dated events and meetings that aren't over yet (sorted ascending). */
  upcoming: Event[];
  /** Events with no date yet ("TBA"), sorted by title. */
  tba: Event[];
  /** Dated events starting within the given month. TBA events are never included. */
  forMonth: (year: number, month: number) => Event[];
  /** Events grouped by category (derived from kind: 'meeting' or 'other'). */
  byCategory: Record<EventCategory, Event[]>;
  /** Add an event to the in-memory store (not saved to Notion). */
  addEvent: (event: Omit<Event, 'id'> & { id?: string }) => Event;
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
  const { events: rawData, isLoading, error } = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (Date.now() - state.loadedAt > RELOAD_AFTER_MS) void loadEvents();
  }, []);

  const data = useMemo(() => [...rawData].sort(compareEvents), [rawData]);

  const addEvent = useCallback((newEvent: Omit<Event, 'id'> & { id?: string }): Event => {
    const event: Event = { ...newEvent, id: newEvent.id || `evt-${Date.now()}` };
    setState({ events: [event, ...state.events] });
    return event;
  }, []);

  const rsvpEvent = useCallback((id: string) => {
    setState({ events: state.events.map((e) => (e.id === id ? { ...e, rsvpCount: (e.rsvpCount || 0) + 1 } : e)) });
  }, []);

  const removeEvent = useCallback((id: string) => {
    setState({ events: state.events.filter((e) => e.id !== id) });
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<Event>) => {
    setState({ events: state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
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
    rsvpEvent,
    removeEvent,
    deleteEvent: removeEvent,
    updateEvent,
  };
}
