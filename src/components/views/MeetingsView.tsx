import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Clock, MapPin } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { eventStart, formatEventDate, formatEventTimeRange } from '@/lib/eventDates';
import { EventOverview } from '@/components/EventOverview';
import type { Event } from '@/lib/types';

/** Newest first; undated meetings go last. */
function compareNewestFirst(a: Event, b: Event) {
  const as = eventStart(a)?.getTime();
  const bs = eventStart(b)?.getTime();
  if (as !== undefined && bs !== undefined) return bs - as;
  if (as !== undefined) return -1;
  if (bs !== undefined) return 1;
  return a.title.localeCompare(b.title);
}

/** Dated and still in the future, so there are no minutes yet. */
function hasNotStarted(meeting: Event) {
  const start = eventStart(meeting);
  return start !== null && start.getTime() > Date.now();
}

/** Meeting minutes: the Notion page of each meeting, one at a time. */
export function MeetingsView() {
  const { data: allItems, isLoading, error } = useEvents();
  const meetings = useMemo(
    () => allItems.filter((e) => e.kind === 'meeting').sort(compareNewestFirst),
    [allItems]
  );

  // Default to the most recent meeting that has already started (it has minutes)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const defaultMeeting = meetings.find((m) => !hasNotStarted(m)) ?? meetings[0];
  const selected = meetings.find((m) => m.id === selectedId) ?? defaultMeeting ?? null;

  return (
    <div className="space-y-10">
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Meeting Minutes</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Agendas and notes from each meeting's Notion page, newest first.
        </p>
      </header>

      {error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn't load meetings — try refreshing.</span>
        </div>
      ) : isLoading ? (
        <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <div className="space-y-2.5">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ) : meetings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No meetings in Notion yet.</p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[18rem_1fr] lg:gap-12">
          {/* ── Meeting list ─────────────────────────────────────────── */}
          <nav aria-label="Meetings">
            <div className="mb-2 flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-lg font-semibold">Meetings</h2>
              <span className="text-xs text-muted-foreground">{meetings.length}</span>
            </div>
            <ul className="divide-y divide-border lg:max-h-[70vh] lg:overflow-y-auto lg:scrollbar-thin">
              {meetings.map((m) => {
                const active = m.id === selected?.id;
                const upcoming = hasNotStarted(m);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'w-full border-l-2 py-3 pl-3 pr-2 text-left transition-colors',
                        active ? 'border-primary bg-muted/30' : 'border-transparent hover:bg-muted/20'
                      )}
                    >
                      <span className={cn('block text-sm', active ? 'font-medium text-primary' : 'text-foreground')}>
                        {m.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {m.startDateTime ? formatEventDate(m, 'EEE, MMM d, yyyy') : 'Date TBA'}
                        {upcoming && (
                          <span className="border border-primary/40 px-1 text-[10px] uppercase tracking-wider text-primary">
                            Upcoming
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* ── Selected meeting's minutes ───────────────────────────── */}
          {selected && (
            <article className="min-w-0">
              <div className="border-b border-border pb-3">
                <h2 className="font-serif text-2xl font-semibold">{selected.title}</h2>
                <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>{selected.startDateTime ? formatEventDate(selected, 'EEEE, MMMM d, yyyy') : 'Date TBA'}</span>
                  {selected.startDateTime && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatEventTimeRange(selected)}
                    </span>
                  )}
                  {selected.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {selected.location}
                    </span>
                  )}
                </div>
              </div>
              <div className="pt-5">
                <EventOverview key={selected.id} eventId={selected.id} notionUrl={selected.notionUrl} />
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
