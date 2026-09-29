import { useState, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Plus,
  CalendarDays,
  Clock,
  MapPin,
  CalendarPlus,
  Trash2,
  Check,
  Users,
  AlertCircle,
  Pencil,
  X as XIcon,
  DollarSign,
  CheckSquare,
  FileCheck2,
  Loader2,
} from 'lucide-react';
import type { Event, EventStatus, EventTodoItem, Task } from '@/lib/types';
import { useEvents } from '@/hooks/useEvents';
import { EVENT_FEATURES } from '@/lib/features';
import { TaskEditDialog } from '@/components/TaskEditDialog';
import { useFinance } from '@/hooks/useFinance';
import { AddTransactionForm, FinanceSummary, TransactionList } from '@/components/finance/FinanceParts';
import { useTasks } from '@/hooks/useTasks';
import { TbaTag } from '@/components/TbaTag';
import { AddEventDialog } from '@/components/AddEventDialog';
import { EpfPanel } from '@/components/EpfPanel';
import { DetailFacts } from '@/components/DetailFacts';
import { PageBody } from '@/components/PageBody';
import { MonthCalendar, ViewModeToggle } from '@/components/MonthCalendar';
import { EventTimeline } from '@/components/EventTimeline';
import { NoEpfBadge } from '@/components/NoEpfBadge';
import { EventWhenFields } from '@/components/EventWhenFields';
import { buildTimeline, whenFromEvent, type WhenValue } from '@/lib/eventWhen';
import { useEpfs } from '@/hooks/useEpfs';
import { eventEnd, eventStart, formatEventDate, formatEventTimeRange, isTba } from '@/lib/eventDates';

/** Calendar chip colours, keyed by event progression status. */
const STATUS_CHIP_CLASSES: Record<EventStatus, string> = {
  'scheduled': 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20',
  'planning-in-progress': 'border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:border-amber-400/40 dark:text-amber-400',
  'done': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:border-emerald-400/40 dark:text-emerald-400',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  'scheduled': 'Scheduled',
  'planning-in-progress': 'Planning in Progress',
  'done': 'Done',
};

// ─────────────────────────────────────────────────────────────────────────────
// iCalendar (.ics) export generator
// ─────────────────────────────────────────────────────────────────────────────

function downloadIcsFile(event: Event) {
  const start = eventStart(event);
  const end = eventEnd(event);
  if (!start || !end) return; // TBA events have nothing to export
  // All-day events use DATE values; DTEND is exclusive, so it's the day after.
  const dtStart = event.allDay ? `DTSTART;VALUE=DATE:${format(start, 'yyyyMMdd')}` : `DTSTART:${format(start, "yyyyMMdd'T'HHmmss")}`;
  const dtEnd = event.allDay
    ? `DTEND;VALUE=DATE:${format(addDays(end, 1), 'yyyyMMdd')}`
    : `DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`;

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
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, // UTC
    dtStart,
    dtEnd,
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

/** Society events from Notion: a chronological list (TBA last) or a month calendar. */
export function EventsView() {
  const [mode, setMode] = useState<'list' | 'calendar' | 'timeline'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [rsvpedEventIds, setRsvpedEventIds] = useState<Set<string>>(new Set());
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const { toast } = useToast();

  // Data layer hook acts as the single source of truth across the app
  const { data: allEvents, tba: tbaEvents, isLoading, error, createEvent, rsvpEvent, saveEvent, deleteEvent, canDelete } = useEvents();
  const [deleting, setDeleting] = useState(false);

  const { byEvent: epfsByEvent, isLoading: epfsLoading, error: epfsError } = useEpfs();
  // Only claim "no EPF" once the list has actually loaded
  const epfsKnown = !epfsLoading && !epfsError;

  // Event detail dialog tab state
  const [eventDetailTab, setEventDetailTab] = useState<'overview' | 'todo' | 'finance'>('overview');
  // Editing the date/time and location
  const [editingDetails, setEditingDetails] = useState(false);

  // Keep selectedEvent in sync with store changes (e.g. after an edit or delete)
  const activeSelectedEvent = useMemo(() => {
    if (!selectedEvent) return null;
    return allEvents.find((e) => e.id === selectedEvent.id) || null;
  }, [allEvents, selectedEvent]);

  const closeEvent = () => {
    setSelectedEvent(null);
    setEventDetailTab('overview');
    setEditingDetails(false);
  };

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
            <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Events</h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              Every society event, in date order. Switch to Calendar for a month view, or Timeline for the whole year.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ViewModeToggle mode={mode} onChange={setMode} modes={['list', 'calendar', 'timeline'] as const} />
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
          <span>Couldn&apos;t load events — try refreshing.</span>
        </div>
      )}

      {mode === 'timeline' ? (
        /* ── Year timeline (Sep 15 2026 – May 31 2027) ── */
        <section>
          <EventTimeline
            events={allEvents}
            isLoading={isLoading}
            onSelect={setSelectedEvent}
            epfStatus={(id) => (epfsByEvent[id] ? 'uploaded' : epfsKnown ? 'missing' : 'unknown')}
          />
        </section>
      ) : mode === 'calendar' ? (
        /* ── Month calendar (events only; TBA events can't be placed) ── */
        <section className="space-y-3">
          <MonthCalendar
            items={allEvents}
            isLoading={isLoading}
            onSelect={setSelectedEvent}
            chipClassName={(e) => STATUS_CHIP_CLASSES[e.status ?? 'scheduled']}
            noun="events"
          />
          {!isLoading && tbaEvents.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {tbaEvents.length} {tbaEvents.length === 1 ? 'event has' : 'events have'} no date yet, so {tbaEvents.length === 1 ? "it isn't" : "they aren't"} on the calendar. See them in List.
            </p>
          )}
        </section>
      ) : (
        /* ── List view (Degrades to stacked cards below 640px) ── */
        <section className="space-y-6">
          <div className="flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="font-serif text-xl font-semibold">All Events</h2>
            <span className="text-xs text-muted-foreground">
              {isLoading
                ? 'Loading...'
                : `${allEvents.length} total${tbaEvents.length ? ` · ${tbaEvents.length} TBA` : ''}`}
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
          ) : allEvents.length === 0 ? (
            <p className="py-8 text-xs text-muted-foreground">
              No events scheduled yet.
            </p>
          ) : (
            <div className="divide-y divide-border border-b border-border">
              {allEvents.map((event) => {
                const tba = isTba(event);
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
                          {tba ? (
                            <TbaTag />
                          ) : (
                            <>
                              <span className="text-xs font-semibold text-primary">
                                {formatEventDate(event, 'EEEE, MMMM d, yyyy')}
                              </span>
                              <span className="text-muted-foreground/60 hidden sm:inline">·</span>
                              <span className="text-xs text-muted-foreground">
                                {formatEventTimeRange(event)}
                              </span>
                            </>
                          )}
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
                        {EVENT_FEATURES.description && event.description && (
                          <p className="pt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>

                      {/* Right metadata / actions on desktop, bottom bar on mobile */}
                      <div className="flex shrink-0 items-center justify-between sm:justify-end gap-3 sm:flex-col sm:items-end sm:gap-2 pt-1 sm:pt-0 border-t border-border/40 sm:border-0">
                        <div className="flex items-center gap-1.5">
                          {epfsByEvent[event.id] ? (
                            <Badge
                              variant="outline"
                              title="EPF uploaded"
                              className="border-emerald-500/40 text-[10px] text-emerald-600 dark:text-emerald-400"
                            >
                              <FileCheck2 className="mr-1 h-3 w-3" />
                              EPF
                            </Badge>
                          ) : (
                            epfsKnown && <NoEpfBadge />
                          )}
                          {event.status && (
                            <Badge variant="outline" className="text-[10px]">
                              {STATUS_LABELS[event.status]}
                            </Badge>
                          )}
                          {canDelete && (
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
                          )}
                        </div>
                        {EVENT_FEATURES.rsvp && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3 sm:hidden" />
                            {event.rsvpCount} Going
                          </span>
                        )}
                        {EVENT_FEATURES.agenda && event.agenda && event.agenda.length > 0 && (
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
      <AddEventDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={createEvent} />

      {/* ── Event Detail View Dialog ─────────────────────────────────── */}
      {activeSelectedEvent && (
        <Dialog
          open={!!activeSelectedEvent}
          onOpenChange={(open) => {
            if (!open) closeEvent();
          }}
        >
          <DialogContent style={{ borderRadius: 0 }} className="max-w-xl border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              {/* Top row: badge + route */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" style={{ borderRadius: 0 }} className="text-[10px] uppercase tracking-wider">
                  Event
                </Badge>
                {isTba(activeSelectedEvent) && <TbaTag />}
                <span className="font-mono text-xs text-muted-foreground">
                  /events/{activeSelectedEvent.id}
                </span>
              </div>

              {/* Title with edit toggle */}
              <div className="mt-2 flex items-start gap-2">
                <DialogTitle className="font-serif text-2xl font-semibold text-foreground">
                  {activeSelectedEvent.title}
                </DialogTitle>
                {!editingDetails && (
                  <button
                    type="button"
                    title="Edit name, date, time and location"
                    aria-label="Edit name, date, time and location"
                    onClick={() => setEditingDetails(true)}
                    className="mt-1.5 p-1 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <DialogDescription className="sr-only">
                {formatEventDate(activeSelectedEvent, 'EEEE, MMMM d, yyyy')}
              </DialogDescription>

              {/* ── Date, time & location ── */}
              <div className="pt-3 text-left">
                <DetailFacts
                  facts={[
                    {
                      icon: CalendarDays,
                      label: 'Date',
                      value: formatEventDate(activeSelectedEvent, 'EEE, MMM d, yyyy'),
                    },
                    ...(isTba(activeSelectedEvent)
                      ? []
                      : [{ icon: Clock, label: 'Time', value: formatEventTimeRange(activeSelectedEvent) }]),
                    {
                      icon: MapPin,
                      label: 'Location',
                      value: activeSelectedEvent.location ?? <span className="font-normal text-muted-foreground">Not set</span>,
                    },
                    ...(EVENT_FEATURES.rsvp
                      ? [{ icon: Users, label: 'Going', value: activeSelectedEvent.rsvpCount }]
                      : []),
                  ]}
                />
              </div>
            </DialogHeader>

            {editingDetails && (
              <EventDetailsEditor event={activeSelectedEvent} onDone={() => setEditingDetails(false)} />
            )}

            {/* ── Progression Status ── */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status:</span>
              {(['scheduled', 'planning-in-progress', 'done'] as EventStatus[]).map((s) => {
                const isActive = (activeSelectedEvent.status ?? 'scheduled') === s;
                const colors: Record<EventStatus, string> = {
                  'scheduled': 'border-border text-muted-foreground hover:border-foreground hover:text-foreground',
                  'planning-in-progress': 'border-amber-500/60 text-amber-600 hover:border-amber-500 hover:text-amber-600',
                  'done': 'border-emerald-500/60 text-emerald-600 hover:border-emerald-500 hover:text-emerald-600',
                };
                const activeColors: Record<EventStatus, string> = {
                  'scheduled': 'bg-foreground text-background border-foreground',
                  'planning-in-progress': 'bg-amber-500 text-white border-amber-500',
                  'done': 'bg-emerald-500 text-white border-emerald-500',
                };
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isActive}
                    aria-pressed={isActive}
                    onClick={() =>
                      saveEvent(activeSelectedEvent.id, { status: s }).catch((err: unknown) =>
                        toast({ title: "Couldn't change the status", description: (err as Error).message, variant: 'destructive' })
                      )
                    }
                    className={cn(
                      'border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-default',
                      isActive ? activeColors[s] : colors[s]
                    )}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>

            {/* ── Inner Tab Nav: Overview / To-do / Finance Reports ── */}
            <div className="flex border-b border-border mt-2">
              {(['overview', 'todo', 'finance'] as const).map((tab) => {
                const tabLabels = { overview: 'Overview', todo: 'To-do', finance: 'Finance Reports' };
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setEventDetailTab(tab)}
                    className={cn(
                      'px-4 py-2 text-xs font-semibold tracking-wide transition-colors border-b-2 -mb-px',
                      eventDetailTab === tab
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tabLabels[tab]}
                  </button>
                );
              })}
            </div>

            {/* ── EPF ── */}
            <div className="pt-4">
              <EpfPanel eventId={activeSelectedEvent.id} />
            </div>

            {/* ── Tab Panels ── */}
            <div className="min-w-0 space-y-6 pt-2 text-sm min-h-[180px]">

              {/* ── OVERVIEW TAB ── */}
              {eventDetailTab === 'overview' && (
                <>
                  <PageBody
                    key={activeSelectedEvent.id}
                    pageId={activeSelectedEvent.id}
                    notionUrl={activeSelectedEvent.notionUrl}
                    noun="Overview"
                  />
                  {EVENT_FEATURES.description && activeSelectedEvent.description && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        About this event
                      </h4>
                      <p className="leading-relaxed text-foreground text-sm">
                        {activeSelectedEvent.description}
                      </p>
                    </div>
                  )}

                  {EVENT_FEATURES.agenda && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Event Schedule &amp; Timeline
                    </h4>
                    {activeSelectedEvent.agenda && activeSelectedEvent.agenda.length > 0 ? (
                      <div className="relative ml-2 space-y-4 border-l border-border py-1 pl-4">
                        {activeSelectedEvent.agenda.map((item, index) => (
                          <div key={index} className="relative">
                            <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-background bg-primary" />
                            <span className="text-xs font-mono font-medium text-primary">{item.time}</span>
                            <h5 className="text-sm font-semibold text-foreground">{item.title}</h5>
                            {item.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground leading-normal">{item.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No breakdown schedule provided for this event.</p>
                    )}
                  </div>
                  )}
                </>
              )}

              {/* ── TO-DO TAB ── */}
              {eventDetailTab === 'todo' && (
                <EventTodoPanel eventId={activeSelectedEvent.id} />
              )}

              {/* ── FINANCE REPORTS TAB ── */}
              {eventDetailTab === 'finance' && (
                <EventFinancePanel eventId={activeSelectedEvent.id} />
              )}
            </div>

            <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                {EVENT_FEATURES.rsvp && (
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
                    <>Going ({activeSelectedEvent.rsvpCount})</>
                  )}
                </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  style={{ borderRadius: 0 }}
                  disabled={isTba(activeSelectedEvent)}
                  title={isTba(activeSelectedEvent) ? 'No date set yet' : undefined}
                  onClick={() => downloadIcsFile(activeSelectedEvent)}
                >
                  <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                  Add to calendar (.ics)
                </Button>

                {canDelete && (
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
                )}
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                style={{ borderRadius: 0 }}
                onClick={closeEvent}
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
              &ldquo;{eventToDelete?.title}&rdquo; will be moved to Notion&apos;s trash, along with its Overview. It can be restored from the trash in Notion for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              style={{ borderRadius: 0 }}
              disabled={deleting}
              onClick={() => setEventToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ borderRadius: 0 }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={async (e) => {
                // Keep the dialog open until Notion confirms
                e.preventDefault();
                if (!eventToDelete) return;
                setDeleting(true);
                try {
                  await deleteEvent(eventToDelete.id);
                  if (selectedEvent?.id === eventToDelete.id) closeEvent();
                  toast({ title: 'Event deleted', description: `"${eventToDelete.title}" was moved to Notion's trash.` });
                  setEventToDelete(null);
                } catch (err) {
                  toast({ title: "Couldn't delete the event", description: (err as Error).message, variant: 'destructive' });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Deleting…' : 'Delete Event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventDetailsEditor — name, date/time (or TBA) and location, saved to Notion
// ─────────────────────────────────────────────────────────────────────────────

function EventDetailsEditor({ event, onDone }: { event: Event; onDone: () => void }) {
  const { saveEvent } = useEvents();
  const { toast } = useToast();
  const [title, setTitle] = useState(event.title);
  const [when, setWhen] = useState<WhenValue>(() => whenFromEvent(event));
  const [location, setLocation] = useState(event.location ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const timeline = buildTimeline(when);
  const canSave = typeof timeline !== 'string' && title.trim() !== '' && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof timeline === 'string' || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveEvent(event.id, { title: title.trim(), ...timeline, location: location.trim() || null });
      toast({ title: 'Event updated', description: 'Saved to Notion.' });
      onDone();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-border p-4">
      <div className="space-y-1.5">
        <Label htmlFor={`edit-${event.id}-title`} className="text-xs">Event name *</Label>
        <Input
          id={`edit-${event.id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          disabled={saving}
          style={{ borderRadius: 0 }}
          required
        />
      </div>
      <EventWhenFields value={when} onChange={setWhen} idPrefix={`edit-${event.id}`} disabled={saving} />
      <div className="space-y-1.5">
        <Label htmlFor={`edit-${event.id}-location`} className="text-xs">
          Location <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`edit-${event.id}-location`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. F4B09a, or Online"
          maxLength={200}
          disabled={saving}
          style={{ borderRadius: 0 }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" style={{ borderRadius: 0 }} disabled={!canSave}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="ghost" style={{ borderRadius: 0 }} disabled={saving} onClick={onDone}>
          Cancel
        </Button>
        {saveError && (
          <span role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Not saved: {saveError}
          </span>
        )}
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventTodoPanel — per-event to-do list
// ─────────────────────────────────────────────────────────────────────────────

function EventTodoPanel({ eventId }: { eventId: string }) {
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { forEvent, toggleTask, createTask, deleteTask, isLoading, error } = useTasks();
  const { toast } = useToast();
  // The event's to-dos are the Notion Tasks linked to it.
  const tasks = forEvent(eventId);
  const todos: (EventTodoItem & { task: Task })[] = tasks.map((t) => ({ id: t.id, text: t.title, completed: t.completed, task: t }));

  const fail = (title: string) => (err: unknown) =>
    toast({ title, description: err instanceof Error ? err.message : undefined, variant: 'destructive' });

  const addTodo = async () => {
    const text = newText.trim();
    if (!text || adding) return;
    setAdding(true);
    try {
      const { warning } = await createTask({ title: text, eventId });
      setNewText('');
      if (warning) toast({ title: 'Task added without a PIC', description: warning });
    } catch (err) {
      fail("Couldn't add task")(err);
    } finally {
      setAdding(false);
    }
  };

  const toggleTodo = (id: string) => void toggleTask(id).catch(fail("Couldn't update task"));
  const deleteTodo = (id: string) =>
    void deleteTask(id)
      .then(() => toast({ title: 'Task deleted', description: 'Moved to Notion trash.' }))
      .catch(fail("Couldn't delete task"));

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <CheckSquare className="h-3.5 w-3.5" />
        To-do List
      </h4>

      {/* Add new todo: creates a Notion task linked to this event, with you as PIC */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a task..."
          disabled={adding}
          className="flex-1 border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary disabled:opacity-60"
          style={{ borderRadius: 0 }}
        />
        <button
          type="button"
          onClick={addTodo}
          disabled={adding || !newText.trim()}
          className="border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>

      {/* Todo list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading tasks…</p>
      ) : error ? (
        <p className="text-xs text-destructive">Couldn&apos;t load tasks — try refreshing.</p>
      ) : todos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No tasks are linked to this event yet. Add one above.</p>
      ) : (
        <div className="divide-y divide-border">
          {todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-3 py-2.5 group">
              <button
                type="button"
                onClick={() => toggleTodo(todo.id)}
                disabled={!todo.task.can.toggle}
                title={todo.task.can.toggle ? undefined : 'Only the PIC or an admin can tick this'}
                className={cn(
                  'h-4 w-4 shrink-0 border flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  todo.completed
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border hover:border-primary'
                )}
              >
                {todo.completed && <Check className="h-2.5 w-2.5" />}
              </button>
              <span className={cn('flex-1 text-xs', todo.completed && 'line-through text-muted-foreground')}>
                {todo.text}
                {todo.task.sharedWith && (
                  <span className="ml-2 text-[10px] text-muted-foreground">{todo.task.sharedWith}</span>
                )}
              </span>
              {todo.task.can.edit && (
                <button
                  type="button"
                  title="Edit task"
                  aria-label={`Edit task ${todo.text}`}
                  onClick={() => setEditingTask(todo.task)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-muted-foreground hover:text-primary transition-all"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {todo.task.can.delete && (
                <button
                  type="button"
                  title="Delete task"
                  aria-label={`Delete task ${todo.text}`}
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {todos.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {todos.filter((t) => t.completed).length} / {todos.length} completed
        </p>
      )}

      <TaskEditDialog task={editingTask} onOpenChange={(open) => !open && setEditingTask(null)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventFinancePanel — per-event finance / budget tracker
// ─────────────────────────────────────────────────────────────────────────────

function EventFinancePanel({ eventId }: { eventId: string }) {
  const { forEvent, totalsForEvent, isLoading, error } = useFinance();
  const transactions = forEvent(eventId);

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <DollarSign className="h-3.5 w-3.5" />
        Finance Report
      </h4>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading transactions…</p>
      ) : error ? (
        <p className="text-xs text-destructive">Couldn&apos;t load finance — try refreshing.</p>
      ) : (
        <>
          {transactions.length > 0 && <FinanceSummary totals={totalsForEvent(eventId)} />}
          <AddTransactionForm eventId={eventId} />
          <TransactionList transactions={transactions} emptyText="No transactions for this event yet. Add income or an expense above." />
        </>
      )}
    </div>
  );
}
