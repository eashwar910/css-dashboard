import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, differenceInCalendarDays, eachMonthOfInterval, eachWeekOfInterval, format, isSameMonth, startOfDay } from 'date-fns';
import { CalendarDays, Clock, FileCheck2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { DetailFacts } from '@/components/DetailFacts';
import { NoEpfBadge } from '@/components/NoEpfBadge';
import type { Event, EventStatus } from '@/lib/types';
import { eventEnd, eventStart, formatEventDate, formatEventDateRange, formatEventTimeRange } from '@/lib/eventDates';

// ─────────────────────────────────────────────────────────────────────────────
// EventTimeline
//
// The academic year (Sep 15 2026 – May 31 2027) across the page, one column per
// month, with a dot per dated event on a line that fills up to today. Hovering
// (or tabbing into) a month widens it so its events have room for their names.
// Hovering an event shows its details; clicking opens the full event dialog.
// TBA events have no place on the line.
// ─────────────────────────────────────────────────────────────────────────────

const RANGE_START = new Date(2026, 8, 15);
const RANGE_END = new Date(2027, 4, 31);

const dayOf = (date: Date) => differenceInCalendarDays(date, RANGE_START);

const MONTHS = eachMonthOfInterval({ start: RANGE_START, end: RANGE_END }).map((m, i, all) => {
  const start = i === 0 ? RANGE_START : m;
  const end = i === all.length - 1 ? RANGE_END : addDays(all[i + 1], -1);
  return {
    date: m,
    startDay: dayOf(start),
    days: differenceInCalendarDays(end, start) + 1,
    mondays: eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).filter((w) => w >= start),
  };
});
type Month = (typeof MONTHS)[number];

/** A short first month still gets enough room for its name. */
const weight = (m: Month) => Math.max(m.days, 24);
/** How much wider the hovered month gets. */
const ZOOM = 3.5;
/** Below this the timeline scrolls sideways instead of squeezing further (phones). */
const MIN_WIDTH = 900;

const HEADER = 44;
const LANES = 5;
const LANE_HEIGHT = 30;
const LANES_TOP = HEADER + 8;
const AXIS_Y = LANES_TOP + LANES * LANE_HEIGHT + 26;
const HEIGHT = AXIS_Y + 64;
const DOT = 12;

const DOT_CLASSES: Record<EventStatus, string> = {
  'scheduled': 'bg-primary',
  'planning-in-progress': 'bg-amber-500',
  'done': 'bg-emerald-500',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  'scheduled': 'Scheduled',
  'planning-in-progress': 'Planning in Progress',
  'done': 'Done',
};

interface Placed {
  event: Event;
  /** Position across the month, as a percentage. */
  pct: number;
  /** null when every lane is taken there; the dot is still shown. */
  lane: number | null;
  /** Label width in px; it hangs left of the dot near the month's right edge. */
  labelWidth: number;
  flip: boolean;
}

/** Greedy lane assignment within one month at `width` px: each label takes the lowest lane that's free. */
function place(events: Event[], month: Month, width: number): Placed[] {
  const laneEnds = new Array<number>(LANES).fill(-Infinity);
  const perDay = new Map<number, number>();
  return events.map((event) => {
    const day = dayOf(eventStart(event)!) - month.startDay;
    // Several events on one day sit side by side
    const nth = perDay.get(day) ?? 0;
    perDay.set(day, nth + 1);
    const x = ((day + 0.5) / month.days) * width + nth * (DOT + 2);
    const labelWidth = Math.max(Math.min(event.title.length * 6.4 + 34, 200, width - 8), 0);
    const flip = x - DOT / 2 + labelWidth > width - 4;
    const from = flip ? x + DOT / 2 - labelWidth : x - DOT / 2;
    // Too narrow to read: dot only
    const lane = labelWidth < 60 ? -1 : laneEnds.findIndex((end) => end < from - 6);
    if (lane !== -1) laneEnds[lane] = Math.max(laneEnds[lane], from + labelWidth);
    return { event, pct: (x / width) * 100, lane: lane === -1 ? null : lane, labelWidth, flip };
  });
}

interface EventTimelineProps {
  events: Event[];
  isLoading: boolean;
  onSelect: (event: Event) => void;
  /** For the EPF / NO EPF badge in the hover card; 'unknown' while EPFs load. */
  epfStatus: (eventId: string) => 'uploaded' | 'missing' | 'unknown';
}

export function EventTimeline({ events, isLoading, onSelect, epfStatus }: EventTimelineProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);
  const [zoomed, setZoomed] = useState<number | null>(null);
  const today = startOfDay(new Date());
  const todayDay = dayOf(today);

  // Fit the year to the box
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(el.clientWidth, MIN_WIDTH)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading]);

  const byMonth = useMemo(() => {
    const lists = MONTHS.map(() => [] as Event[]);
    for (const e of events) {
      const start = eventStart(e);
      if (!start || startOfDay(start) < RANGE_START || startOfDay(start) > RANGE_END) continue;
      lists[MONTHS.findIndex((m) => isSameMonth(m.date, start))].push(e);
    }
    return lists;
  }, [events]);

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;

  const grows = MONTHS.map((m, i) => weight(m) * (zoomed === i ? ZOOM : 1));
  const totalGrow = grows.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {(Object.keys(DOT_CLASSES) as EventStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', DOT_CLASSES[s])} />
            {STATUS_LABELS[s]}
          </span>
        ))}
        <span className="ml-auto">Hover a month to zoom in · numbers are Mondays</span>
      </div>

      <div ref={boxRef} className="scrollbar-thin overflow-x-auto rounded-xl border border-border bg-gradient-to-b from-muted/40 to-background shadow-sm">
        <div className="relative flex" style={{ width, height: HEIGHT }} onMouseLeave={() => setZoomed(null)}>
          {MONTHS.map((month, i) => {
            const monthWidth = (width * grows[i]) / totalGrow;
            const placed = place(byMonth[i], month, monthWidth);
            const isCurrent = isSameMonth(month.date, today);
            const zoom = zoomed === i;
            // How much of this month's line is in the past, 0–100
            const progress = Math.min(Math.max(((todayDay - month.startDay) / month.days) * 100, 0), 100);
            const hidden = placed.filter((p) => p.lane === null).length;
            return (
              <section
                key={month.date.toISOString()}
                aria-label={format(month.date, 'MMMM yyyy')}
                onMouseEnter={() => setZoomed(i)}
                onFocus={() => setZoomed(i)}
                className={cn(
                  'relative min-w-0 transition-[flex-grow,background-color] duration-300 ease-out',
                  i > 0 && 'border-l border-border/50',
                  zoom ? 'bg-primary/[0.06]' : isCurrent ? 'bg-primary/[0.03]' : i % 2 === 1 && 'bg-muted/20'
                )}
                style={{ flexGrow: grows[i], flexBasis: 0 }}
              >
                {/* Month name and count */}
                <header className="flex items-baseline gap-1.5 overflow-hidden whitespace-nowrap px-3 pt-3">
                  <span className={cn('font-serif text-sm font-semibold', isCurrent ? 'text-primary' : 'text-foreground')}>
                    {format(month.date, zoom || monthWidth > 110 ? 'MMMM' : 'MMM')}
                  </span>
                  {(i === 0 || month.date.getMonth() === 0) && <span className="text-[11px] text-muted-foreground">{format(month.date, 'yyyy')}</span>}
                  {byMonth[i].length > 0 && (
                    <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground" title={`${byMonth[i].length} events`}>
                      {byMonth[i].length}
                    </span>
                  )}
                </header>
                {hidden > 0 && !zoom && (
                  <span className="absolute left-3 text-[10px] text-muted-foreground/80" style={{ top: AXIS_Y - 26 }}>
                    +{hidden} more
                  </span>
                )}

                {/* The line, filled up to today */}
                <div className="absolute inset-x-0 h-1 bg-border" style={{ top: AXIS_Y - 2 }}>
                  <div className="h-full bg-primary/50" style={{ width: `${progress}%` }} />
                </div>

                {/* Mondays */}
                {month.mondays.map((w) => (
                  <div
                    key={w.toISOString()}
                    className="absolute flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${((dayOf(w) - month.startDay + 0.5) / month.days) * 100}%`, top: AXIS_Y + 6 }}
                  >
                    <span className="h-1.5 w-px bg-foreground/30" />
                    <span className="mt-1 text-[10px] tabular-nums text-muted-foreground">{format(w, 'd')}</span>
                  </div>
                ))}

                {/* Today */}
                {progress > 0 && progress < 100 && (
                  <div className="pointer-events-none absolute w-px bg-destructive/70" style={{ left: `${progress}%`, top: HEADER, height: AXIS_Y - HEADER + 28 }}>
                    <span className="absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap rounded-full bg-destructive px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-destructive-foreground shadow-sm">
                      Today
                    </span>
                  </div>
                )}

                {/* Events */}
                {placed.map(({ event, pct, lane, labelWidth, flip }) => {
                  const top = lane === null ? AXIS_Y - DOT / 2 : LANES_TOP + (LANES - 1 - lane) * LANE_HEIGHT;
                  const status = event.status ?? 'scheduled';
                  const past = (eventEnd(event) ?? eventStart(event)!) < today;
                  return (
                    <HoverCard key={event.id} openDelay={120} closeDelay={60}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSelect(event)}
                          aria-label={`${event.title}, ${formatEventDate(event, 'MMM d')}`}
                          className={cn(
                            'group absolute flex -translate-x-1/2 flex-col items-center transition-[left,top,opacity] duration-300 ease-out hover:!z-30 hover:opacity-100 focus:outline-none focus-visible:!z-30 focus-visible:opacity-100',
                            past && 'opacity-55'
                          )}
                          // Labels nearer the line sit on top, so taller stems pass behind them
                          style={{ left: `${pct}%`, top, width: DOT, height: AXIS_Y + DOT / 2 - top, zIndex: 10 + LANES - (lane ?? 0) }}
                        >
                          {lane !== null && (
                            <span
                              className={cn(
                                'absolute top-0 flex h-6 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-[11px] font-medium text-foreground shadow-sm transition-all duration-200',
                                'group-hover:-translate-y-0.5 group-hover:border-primary/60 group-hover:shadow-md group-focus-visible:border-primary group-focus-visible:ring-2 group-focus-visible:ring-primary/30',
                                flip ? 'right-0' : 'left-0'
                              )}
                              style={{ maxWidth: labelWidth }}
                            >
                              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_CLASSES[status])} />
                              <span className="truncate">{event.title}</span>
                            </span>
                          )}
                          {lane !== null && <span className="mt-6 w-px flex-1 bg-gradient-to-b from-border to-foreground/30 group-hover:from-primary/40 group-hover:to-primary" />}
                          <span
                            className={cn(
                              'mt-auto h-3 w-3 shrink-0 rounded-full shadow ring-[3px] ring-background transition-transform duration-200 group-hover:scale-[1.35] group-focus-visible:scale-[1.35]',
                              DOT_CLASSES[status]
                            )}
                          />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent side="top" className="w-96 rounded-xl border-border p-4 shadow-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1.5 text-[10px]">
                            <span className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASSES[status])} />
                            {STATUS_LABELS[status]}
                          </Badge>
                          {epfStatus(event.id) === 'uploaded' && (
                            <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <FileCheck2 className="mr-1 h-3 w-3" />
                              EPF
                            </Badge>
                          )}
                          {epfStatus(event.id) === 'missing' && <NoEpfBadge />}
                        </div>
                        <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-foreground">{event.title}</h3>
                        <div className="mt-3">
                          <DetailFacts
                            facts={[
                              { icon: CalendarDays, label: 'Date', value: formatEventDateRange(event, 'EEE, MMM d, yyyy') },
                              { icon: Clock, label: 'Time', value: formatEventTimeRange(event) },
                              {
                                icon: MapPin,
                                label: 'Location',
                                value: event.location ?? <span className="font-normal text-muted-foreground">Not set</span>,
                              },
                            ]}
                          />
                        </div>
                        <p className="mt-3 text-[11px] text-muted-foreground">Click for the overview, to-dos and finance.</p>
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
