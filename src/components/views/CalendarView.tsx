import { useState, useMemo } from 'react';
import {
  format,
  parseISO,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  compareAsc,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  CalendarPlus,
  CalendarDays,
  ListFilter,
  Trash2,
  Check,
  Users,
  AlertCircle,
} from 'lucide-react';
import type { Event, EventCategory, AgendaItem } from '@/lib/types';
import { useEvents } from '@/hooks/useEvents';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHourLabel(h: number) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

// ─────────────────────────────────────────────────────────────────────────────
// iCalendar (.ics) export generator
// ─────────────────────────────────────────────────────────────────────────────

function downloadIcsFile(event: Event) {
  const start = parseISO(event.startDateTime);
  const end = parseISO(event.endDateTime);
  const formatIcsDate = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");

  let desc = event.description || '';
  if (event.agenda && event.agenda.length > 0) {
    desc +=
      '\n\nAgenda:\n' +
      event.agenda
        .map(
          (item) =>
            `${item.time} - ${item.title}${item.description ? `: ${item.description}` : ''}`
        )
        .join('\n');
  }

  const escapeIcs = (str: string) =>
    str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CS Society//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}-${Date.now()}@css-dashboard`,
    `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(desc)}`,
    ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
  const [rsvpedEventIds, setRsvpedEventIds] = useState<Set<string>>(new Set());
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const { toast } = useToast();

  // Data layer hook acts as the single source of truth across the app
  const { data: allEvents, isLoading, error, forMonth, addEvent, rsvpEvent, removeEvent } = useEvents();

  // Keep selectedEvent in sync with store changes (e.g. when RSVP count changes or event is deleted)
  const activeSelectedEvent = useMemo(() => {
    if (!selectedEvent) return null;
    return allEvents.find((e) => e.id === selectedEvent.id) || null;
  }, [allEvents, selectedEvent]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Month-specific sorted events for grid and schedule sidebar
  const monthlySortedEvents = useMemo(
    () => forMonth(currentDate.getFullYear(), currentDate.getMonth()),
    [forMonth, currentDate]
  );

  // All events sorted chronologically for Agenda/List view
  const allEventsChronological = useMemo(() => {
    return [...allEvents].sort((a, b) =>
      compareAsc(parseISO(a.startDateTime), parseISO(b.startDateTime))
    );
  }, [allEvents]);

  const eventsForDay = (day: Date) =>
    allEvents.filter((e) => isSameDay(parseISO(e.startDateTime), day));

  const handlePrevMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const handleNextMonth = () => setCurrentDate((d) => addMonths(d, 1));
  const handleToday = () => setCurrentDate(new Date(2026, 8, 1));

  const eventsForSelected = selectedDate ? eventsForDay(selectedDate) : [];

  const handleRsvpToggle = (eventId: string) => {
    if (!rsvpedEventIds.has(eventId)) {
      rsvpEvent(eventId);
      setRsvpedEventIds((prev) => new Set(prev).add(eventId));
    }
  };

  return (
    <div className="space-y-10">

      {/* ── Page header & Toolbar ────────────────────────────────────── */}
      <header className="border-b border-border pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">
              Calendar &amp; Events
            </h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              View, create, and manage all society events and detailed schedules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-border">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'month'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-pressed={viewMode === 'month'}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Month Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('agenda')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'agenda'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-pressed={viewMode === 'agenda'}
              >
                <ListFilter className="h-3.5 w-3.5" />
                List / Agenda
              </button>
            </div>

            <button
              onClick={() => setDialogOpen(true)}
              style={{ borderRadius: 0 }}
              className="flex items-center gap-2 border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add event
            </button>
          </div>
        </div>
      </header>

      {/* ── Error Banner if any ──────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn&apos;t load calendar events — try refreshing.</span>
        </div>
      )}

      {/* ── View 1: Month Grid View ──────────────────────────────────── */}
      {viewMode === 'month' ? (
        <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">

          {/* ── Monthly calendar (3 cols) ────────────────────────────── */}
          <div className="lg:col-span-3">
            {/* Month navigation */}
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-serif text-xl font-semibold">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                  className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleToday}
                  className="border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Today
                </button>
                <button
                  onClick={handleNextMonth}
                  aria-label="Next month"
                  className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div
                  key={d}
                  className="py-1.5 text-center text-[11px] font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar day cells */}
            <div className="grid grid-cols-7 border-l border-border">
              {days.map((day) => {
                const dayEvents = eventsForDay(day);
                const inMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                    className={cn(
                      'relative flex min-h-[72px] flex-col border-b border-r border-border p-1.5 text-left transition-colors sm:min-h-[88px] cursor-pointer',
                      inMonth ? 'bg-background' : 'bg-muted/20',
                      !inMonth && 'text-muted-foreground',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block text-xs font-medium leading-none',
                        isToday && 'font-bold text-primary underline underline-offset-2',
                        isSelected && !isToday && 'text-primary'
                      )}
                    >
                      {format(day, 'd')}
                    </span>

                    {isLoading ? (
                      <div className="mt-2 hidden sm:block">
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ) : dayEvents.length > 0 ? (
                      <div className="mt-1 hidden flex-col gap-1 overflow-hidden sm:flex">
                        {dayEvents.slice(0, 2).map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setSelectedEvent(e);
                            }}
                            className="truncate text-left border border-primary/20 bg-primary/10 px-1 py-0.5 text-[0.62rem] leading-tight text-primary hover:bg-primary/20 transition-colors"
                          >
                            {e.title}
                          </button>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="px-1 text-[0.6rem] text-muted-foreground">
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </div>
                    ) : null}

                    {dayEvents.length > 0 && !isLoading && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 bg-primary sm:hidden" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected-day detail */}
            {selectedDate && (
              <div className="border-t border-border pt-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </p>
                {isLoading ? (
                  <div className="space-y-3 py-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ) : eventsForSelected.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No events on this day.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {eventsForSelected.map((e) => {
                      const s = parseISO(e.startDateTime);
                      return (
                        <div
                          key={e.id}
                          onClick={() => setSelectedEvent(e)}
                          className="group cursor-pointer py-3 transition-colors hover:text-primary"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-serif text-sm font-semibold">{e.title}</p>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {e.category}
                              </Badge>
                              <button
                                type="button"
                                title="Delete event"
                                aria-label={`Delete event ${e.title}`}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setEventToDelete(e);
                                }}
                                className="p-1 text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {format(s, 'h:mm a')} – {format(parseISO(e.endDateTime), 'h:mm a')}
                            {e.location && ` · ${e.location}`}
                          </p>
                          {e.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {e.description}
                            </p>
                          )}
                          {e.agenda.length > 0 && (
                            <p className="mt-1.5 text-[11px] text-primary/80">
                              {e.agenda.length} agenda {e.agenda.length === 1 ? 'item' : 'items'} · Click to view timeline
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Event schedule sidebar (2 cols) ──────────────────────── */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-lg font-semibold">Event Schedule</h2>
              <span className="text-xs text-muted-foreground">
                {isLoading ? 'Loading...' : `${monthlySortedEvents.length} in ${format(currentDate, 'MMMM')}`}
              </span>
            </div>

            <ScrollArea className="h-[560px] scrollbar-thin">
              {isLoading ? (
                <div className="divide-y divide-border pr-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="py-4 space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-4/5" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  ))}
                </div>
              ) : monthlySortedEvents.length === 0 ? (
                <p className="py-8 text-xs text-muted-foreground">
                  No events scheduled for this month.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {monthlySortedEvents.map((event) => {
                    const start = parseISO(event.startDateTime);
                    const end = parseISO(event.endDateTime);
                    return (
                      <article
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="group cursor-pointer py-4 pr-2 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {format(start, 'EEE, MMM d')}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {event.category}
                            </Badge>
                            <button
                              type="button"
                              title="Delete event"
                              aria-label={`Delete event ${event.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEventToDelete(event);
                              }}
                              className="p-1 text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 font-serif text-base font-semibold leading-snug group-hover:text-primary transition-colors">
                          {event.title}
                        </p>
                        <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {event.location}
                            </span>
                          )}
                          {event.rsvpCount > 0 && (
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3 w-3 shrink-0" />
                              {event.rsvpCount} Going
                            </span>
                          )}
                        </div>
                        {event.agenda && event.agenda.length > 0 && (
                          <div className="mt-2 text-[11px] text-muted-foreground/80">
                            {event.agenda.length} scheduled segments
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      ) : (
        /* ── View 2: List / Agenda View (Degrades to stacked cards below 640px) ── */
        <section className="space-y-6">
          <div className="flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="font-serif text-xl font-semibold">All Events (Chronological)</h2>
            <span className="text-xs text-muted-foreground">
              {isLoading ? 'Loading...' : `${allEventsChronological.length} total events`}
            </span>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border border-b border-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="py-5 space-y-2.5 sm:px-4">
                  <Skeleton className="h-3.5 w-44" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3.5 w-1/3" />
                </div>
              ))}
            </div>
          ) : allEventsChronological.length === 0 ? (
            <p className="py-8 text-xs text-muted-foreground">
              No events scheduled yet.
            </p>
          ) : (
            <div className="divide-y divide-border border-b border-border">
              {allEventsChronological.map((event) => {
                const start = parseISO(event.startDateTime);
                const end = parseISO(event.endDateTime);
                return (
                  <article
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="group cursor-pointer py-5 transition-colors hover:bg-muted/10 sm:px-4"
                  >
                    {/* Responsive container: stacked card below 640px (< sm), horizontal on >= sm */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-primary">
                            {format(start, 'EEEE, MMMM d, yyyy')}
                          </span>
                          <span className="text-muted-foreground/60 hidden sm:inline">·</span>
                          <span className="text-xs text-muted-foreground">
                            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                          </span>
                          {/* Mobile-only badge inline with date */}
                          <Badge variant="outline" className="sm:hidden text-[10px] capitalize ml-auto">
                            {event.category}
                          </Badge>
                        </div>
                        <h3 className="font-serif text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                        {event.location && (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {event.location}
                          </p>
                        )}
                        {event.description && (
                          <p className="pt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>

                      {/* Right metadata / actions on desktop, bottom bar on mobile */}
                      <div className="flex shrink-0 items-center justify-between sm:justify-end gap-3 sm:flex-col sm:items-end sm:gap-2 pt-1 sm:pt-0 border-t border-border/40 sm:border-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="hidden sm:inline-flex text-[10px] capitalize">
                            {event.category}
                          </Badge>
                          <button
                            type="button"
                            title="Delete event"
                            aria-label={`Delete event ${event.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEventToDelete(event);
                            }}
                            className="p-1 text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3 sm:hidden" />
                          {event.rsvpCount} Going
                        </span>
                        {event.agenda && event.agenda.length > 0 && (
                          <span className="text-[11px] text-primary/80">
                            {event.agenda.length} {event.agenda.length === 1 ? 'segment' : 'segments'}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Create Event Dialog ──────────────────────────────────────── */}
      <CreateEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={(event) => addEvent(event)}
      />

      {/* ── Event Detail View Dialog ─────────────────────────────────── */}
      {activeSelectedEvent && (
        <Dialog open={!!activeSelectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent style={{ borderRadius: 0 }} className="max-w-xl border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" style={{ borderRadius: 0 }} className="text-[10px] uppercase tracking-wider capitalize">
                  {activeSelectedEvent.category}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  /events/{activeSelectedEvent.id}
                </span>
              </div>
              <DialogTitle className="font-serif text-2xl mt-2 font-semibold text-foreground">
                {activeSelectedEvent.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {format(parseISO(activeSelectedEvent.startDateTime), 'EEEE, MMMM d, yyyy')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-2 text-sm">
              {/* Timing & Location bar */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {format(parseISO(activeSelectedEvent.startDateTime), 'h:mm a')}
                  {' – '}
                  {format(parseISO(activeSelectedEvent.endDateTime), 'h:mm a')}
                </span>
                {activeSelectedEvent.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {activeSelectedEvent.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  {activeSelectedEvent.rsvpCount} Going
                </span>
              </div>

              {/* Description */}
              {activeSelectedEvent.description && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    About this event
                  </h4>
                  <p className="leading-relaxed text-foreground text-sm">
                    {activeSelectedEvent.description}
                  </p>
                </div>
              )}

              {/* Full Agenda Mini-Timeline */}
              <div className="space-y-3 border-t border-border pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Event Schedule &amp; Timeline
                </h4>

                {activeSelectedEvent.agenda && activeSelectedEvent.agenda.length > 0 ? (
                  <div className="relative ml-2 space-y-4 border-l border-border py-1 pl-4">
                    {activeSelectedEvent.agenda.map((item, index) => (
                      <div key={index} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-background bg-primary" />
                        <span className="text-xs font-mono font-medium text-primary">
                          {item.time}
                        </span>
                        <h5 className="text-sm font-semibold text-foreground">
                          {item.title}
                        </h5>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground leading-normal">
                            {item.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No breakdown schedule provided for this event.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                {/* RSVP Going button */}
                <Button
                  size="sm"
                  variant={rsvpedEventIds.has(activeSelectedEvent.id) ? 'secondary' : 'default'}
                  style={{ borderRadius: 0 }}
                  onClick={() => handleRsvpToggle(activeSelectedEvent.id)}
                  disabled={rsvpedEventIds.has(activeSelectedEvent.id)}
                >
                  {rsvpedEventIds.has(activeSelectedEvent.id) ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      You&apos;re Going ({activeSelectedEvent.rsvpCount})
                    </>
                  ) : (
                    <>
                      Going ({activeSelectedEvent.rsvpCount})
                    </>
                  )}
                </Button>

                {/* Add to Calendar (.ics) button */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  style={{ borderRadius: 0 }}
                  onClick={() => downloadIcsFile(activeSelectedEvent)}
                >
                  <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                  Add to calendar (.ics)
                </Button>

                {/* Delete Event button */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  style={{ borderRadius: 0 }}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                  onClick={() => setEventToDelete(activeSelectedEvent)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                style={{ borderRadius: 0 }}
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirm Delete Event Dialog ──────────────────────────────── */}
      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent style={{ borderRadius: 0 }} className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold">
              Delete Event
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to remove &ldquo;{eventToDelete?.title}&rdquo;? This will remove the event from the calendar and schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              style={{ borderRadius: 0 }}
              onClick={() => setEventToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ borderRadius: 0 }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (eventToDelete) {
                  removeEvent(eventToDelete.id);
                  if (selectedEvent?.id === eventToDelete.id) {
                    setSelectedEvent(null);
                  }
                  toast({
                    title: 'Event deleted',
                    description: `"${eventToDelete.title}" has been removed.`,
                  });
                  setEventToDelete(null);
                }
              }}
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateEventDialog with repeatable Agenda / Sub-schedule items
// ─────────────────────────────────────────────────────────────────────────────

function CreateEventDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (event: Omit<Event, 'id'> & { id?: string }) => void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('19:30');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<EventCategory>('workshop');
  const [agenda, setAgenda] = useState<AgendaItem[]>([
    { time: '6:00 PM', title: 'Introduction & Welcome', description: '' },
  ]);

  const handleAddAgendaRow = () => {
    setAgenda((prev) => [...prev, { time: '', title: '', description: '' }]);
  };

  const handleRemoveAgendaRow = (index: number) => {
    setAgenda((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAgendaChange = (index: number, field: keyof AgendaItem, value: string) => {
    setAgenda((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !startTime) return;

    const startDateTime = `${startDate}T${startTime}:00`;
    const resolvedEndDate = endDate || startDate;
    const resolvedEndTime = endTime || startTime;
    const endDateTime = `${resolvedEndDate}T${resolvedEndTime}:00`;

    // Filter out completely empty agenda rows
    const cleanedAgenda = agenda.filter(
      (item) => item.time.trim() !== '' || item.title.trim() !== ''
    );

    onAdd({
      id: `evt-${Date.now()}`,
      title: name,
      startDateTime,
      endDateTime,
      description,
      location: location || undefined,
      category,
      agenda: cleanedAgenda,
      rsvpCount: 0,
    });

    // Reset form state
    setName('');
    setStartDate('');
    setStartTime('18:00');
    setEndDate('');
    setEndTime('19:30');
    setDescription('');
    setLocation('');
    setCategory('workshop');
    setAgenda([{ time: '6:00 PM', title: 'Introduction & Welcome', description: '' }]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ borderRadius: 0 }} className="max-w-xl max-h-[90vh] overflow-y-auto border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-semibold flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-primary" />
            New Society Event
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Schedule a new event, timing, and segment breakdown for the society calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="event-name" className="text-xs">Event Title *</Label>
            <Input
              id="event-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual Hackathon Kickoff"
              style={{ borderRadius: 0 }}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="event-category" className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
              <SelectTrigger id="event-category" style={{ borderRadius: 0 }}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent style={{ borderRadius: 0 }}>
                {(['workshop', 'social', 'meeting', 'hackathon', 'talk', 'other'] as EventCategory[]).map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-xs">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ borderRadius: 0 }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start-time" className="text-xs">Start Time *</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="start-time" style={{ borderRadius: 0 }}>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[220px]" style={{ borderRadius: 0 }}>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h).padStart(2, '0') + ':00'}>
                      {formatHourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* End Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-xs">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ borderRadius: 0 }}
                placeholder="Same as start date"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-time" className="text-xs">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="end-time" style={{ borderRadius: 0 }}>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[220px]" style={{ borderRadius: 0 }}>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h).padStart(2, '0') + ':00'}>
                      {formatHourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="event-location" className="text-xs">Location (optional)</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Computer Science Atrium / Online"
              style={{ borderRadius: 0 }}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="event-description" className="text-xs">Description</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what attendees can expect..."
              style={{ borderRadius: 0 }}
              rows={2}
            />
          </div>

          {/* Agenda / Repeatable Sub-Schedule */}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">Agenda &amp; Timeline Segments</Label>
                <p className="text-[11px] text-muted-foreground">
                  Add multi-part segments or schedule breakdown (e.g. for workshops, hackathons)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddAgendaRow}
                className="flex items-center gap-1 border border-border px-2 py-1 text-xs text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Segment
              </button>
            </div>

            <div className="space-y-2 pt-1">
              {agenda.map((row, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 border border-border bg-muted/10 p-2 text-xs"
                >
                  <div className="w-24 shrink-0">
                    <Input
                      placeholder="e.g. 10:00 AM"
                      value={row.time}
                      onChange={(e) => handleAgendaChange(index, 'time', e.target.value)}
                      style={{ borderRadius: 0 }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Segment title (e.g. Keynote)"
                      value={row.title}
                      onChange={(e) => handleAgendaChange(index, 'title', e.target.value)}
                      style={{ borderRadius: 0 }}
                      className="h-8 text-xs font-medium"
                    />
                    <Input
                      placeholder="Optional notes / details"
                      value={row.description || ''}
                      onChange={(e) => handleAgendaChange(index, 'description', e.target.value)}
                      style={{ borderRadius: 0 }}
                      className="h-7 text-xs text-muted-foreground"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAgendaRow(index)}
                    aria-label="Remove agenda row"
                    className="mt-1 p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              style={{ borderRadius: 0 }}
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              style={{ borderRadius: 0 }}
              className="text-xs"
            >
              Create Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
