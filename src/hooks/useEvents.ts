import { useState, useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import { parseISO, isSameMonth, isFuture, compareAsc } from 'date-fns';
import type { AsyncResult, Event, EventCategory } from '@/lib/types';
import { mockEvents } from '@/data';

// ─────────────────────────────────────────────────────────────────────────────
// Shared in-memory event store
//
// Acts as the single source of truth across views (Calendar & Events, Home,
// search). Simulates an initial artificial latency (400ms) to exercise loading
// skeletons and empty/error states before real API integration.
// ─────────────────────────────────────────────────────────────────────────────

let eventsStore: Event[] = [...mockEvents];
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Event[] {
  return eventsStore;
}

export interface EventsResult extends AsyncResult<Event[]> {
  /** Events whose startDateTime is in the future (sorted ascending). */
  upcoming: Event[];
  /** Events that fall within the provided month (defaults to current month). */
  forMonth: (year: number, month: number) => Event[];
  /** Events grouped by category. */
  byCategory: Record<EventCategory, Event[]>;
  /** Add a new event to the shared event store */
  addEvent: (event: Omit<Event, 'id'> & { id?: string }) => Event;
  /** Increment the RSVP count for an event */
  rsvpEvent: (id: string) => void;
  /** Remove an event from the shared event store */
  removeEvent: (id: string) => void;
  /** Alias for removeEvent */
  deleteEvent: (id: string) => void;
  /** Partial-update an existing event in the shared event store */
  updateEvent: (id: string, patch: Partial<Event>) => void;
}

export function useEvents(): EventsResult {
  const rawData = useSyncExternalStore(subscribe, getSnapshot, () => mockEvents);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const data = useMemo(() => (isLoading ? [] : rawData), [isLoading, rawData]);

  const addEvent = useCallback((newEvent: Omit<Event, 'id'> & { id?: string }): Event => {
    const event: Event = {
      ...newEvent,
      id: newEvent.id || `evt-${Date.now()}`,
    };
    eventsStore = [event, ...eventsStore];
    emitChange();
    return event;
  }, []);

  const rsvpEvent = useCallback((id: string) => {
    eventsStore = eventsStore.map((e) =>
      e.id === id ? { ...e, rsvpCount: (e.rsvpCount || 0) + 1 } : e
    );
    emitChange();
  }, []);

  const removeEvent = useCallback((id: string) => {
    eventsStore = eventsStore.filter((e) => e.id !== id);
    emitChange();
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<Event>) => {
    eventsStore = eventsStore.map((e) => (e.id === id ? { ...e, ...patch } : e));
    emitChange();
  }, []);

  const upcoming = useMemo(
    () =>
      data
        .filter((e) => isFuture(parseISO(e.startDateTime)))
        .sort((a, b) =>
          compareAsc(parseISO(a.startDateTime), parseISO(b.startDateTime))
        ),
    [data]
  );

  const forMonth = useMemo(
    () =>
      (year: number, month: number): Event[] => {
        const ref = new Date(year, month, 1);
        return data
          .filter((e) => isSameMonth(parseISO(e.startDateTime), ref))
          .sort((a, b) =>
            compareAsc(parseISO(a.startDateTime), parseISO(b.startDateTime))
          );
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
    forMonth,
    byCategory,
    addEvent,
    rsvpEvent,
    removeEvent,
    deleteEvent: removeEvent,
    updateEvent,
  };
}
