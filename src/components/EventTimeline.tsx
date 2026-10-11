import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, differenceInCalendarDays, eachMonthOfInterval, eachWeekOfInterval, format, startOfDay } from 'date-fns';
import { CalendarDays, Clock, FileCheck2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { DetailFacts } from '@/components/DetailFacts';
import { NoEpfBadge } from '@/components/NoEpfBadge';
import type { Event, EventStatus } from '@/lib/types';
import { eventStart, formatEventDate, formatEventDateRange, formatEventTimeRange } from '@/lib/eventDates';

// ─────────────────────────────────────────────────────────────────────────────
// EventTimeline
//
// The academic year (Sep 15 2026 – May 31 2027) as one horizontal line that
// fits the page, with a dot per dated event. Hovering the line magnifies the
// weeks around the cursor (a fisheye), so crowded stretches spread out and
// their labels fit. Hovering a dot shows the event's details; clicking opens
// the full event dialog. TBA events have no place on the line.
// ─────────────────────────────────────────────────────────────────────────────

const RANGE_START = new Date(2026, 8, 15);
const RANGE_END = new Date(2027, 4, 31);
const TOTAL_DAYS = differenceInCalendarDays(RANGE_END, RANGE_START) + 1;

const PAD_X = 24;
/** Below this the line scrolls sideways instead of squeezing further (phones). */
const MIN_WIDTH = 900;

/** How much the lens magnifies at the cursor, and its radius in days. */
const LENS_ZOOM = 4;
const LENS_DAYS = 14;

/** Title labels stack in lanes above the line so they don't overlap. */
const LANES = 5;
const LANE_HEIGHT = 26;
/** First lane's top, clear of the month names. */
const LABEL_TOP = 40;
/** Space between the lowest label and the line. */
const LINE_GAP = 28;
const LINE_Y = LABEL_TOP + LANES * LANE_HEIGHT + LINE_GAP;
const TRACK_HEIGHT = LINE_Y + 64;
const DOT = 12;

/** Positions ease to their new place as the lens moves. */
const MOVE = 'transition-[left,top,width,height] duration-150 ease-out';

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

const dayOf = (date: Date) => differenceInCalendarDays(date, RANGE_START);

/**
 * Day offset (fractional; day d spans [d, d+1]) → x in px across `width`.
 * With a focus day, days near it get up to LENS_ZOOM× the room and the rest
 * shrink to make up for it. The focus keeps its unmagnified x, so whatever is
 * under the cursor stays under it.
 */
function makeScale(width: number, focus: number | null): (day: number) => number {
  const inner = width - PAD_X * 2;
  if (focus === null) return (day) => PAD_X + (day / TOTAL_DAYS) * inner;

  // cum[d] = room taken by days before d
  const cum = [0];
  for (let d = 0; d < TOTAL_DAYS; d++) {
    cum.push(cum[d] + 1 + (LENS_ZOOM - 1) * Math.exp(-(((d + 0.5 - focus) / LENS_DAYS) ** 2)));
  }
  const at = (day: number) => {
    const i = Math.min(Math.max(Math.floor(day), 0), TOTAL_DAYS - 1);
    return cum[i] + (cum[i + 1] - cum[i]) * (day - i);
  };
  const f = at(focus);
  const fx = (focus / TOTAL_DAYS) * inner;
  const end = cum[TOTAL_DAYS];
  return (day) => {
    const c = at(day);
    return PAD_X + (c <= f ? (f > 0 ? (c / f) * fx : 0) : fx + ((c - f) / (end - f)) * (inner - fx));
  };
}

interface Placed {
  event: Event;
  x: number;
  /** null when every lane is taken there; the dot is still shown. */
  lane: number | null;
}

/** Greedy lane assignment: each label takes the lowest lane that's free at its x. */
function place(events: Event[], scale: (day: number) => number): Placed[] {
  const laneEnds = new Array<number>(LANES).fill(-Infinity);
  const perDay = new Map<number, number>();
  return events.map((event) => {
    const day = dayOf(eventStart(event)!);
    // Several events on one day sit side by side
    const nth = perDay.get(day) ?? 0;
    perDay.set(day, nth + 1);
    const x = scale(day + 0.5) + nth * (DOT + 2);
    const width = Math.min(event.title.length * 6.5 + 20, 180);
    const lane = laneEnds.findIndex((end) => end < x - DOT / 2);
    if (lane !== -1) laneEnds[lane] = x - DOT / 2 + width + 6;
    return { event, x, lane: lane === -1 ? null : lane };
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
  /** The day under the mouse, or null when it's off the line. */
  const [focus, setFocus] = useState<number | null>(null);
  const today = startOfDay(new Date());
  const todayInRange = today >= RANGE_START && today <= RANGE_END;

  // Fit the year to the box
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(el.clientWidth, MIN_WIDTH)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading]);

  const dated = useMemo(
    () =>
      events.filter((e) => {
        const start = eventStart(e);
        return start !== null && startOfDay(start) >= RANGE_START && startOfDay(start) <= RANGE_END;
      }),
    [events]
  );

  const scale = useMemo(() => makeScale(width, focus), [width, focus]);
  const placed = place(dated, scale);

  const months = eachMonthOfInterval({ start: RANGE_START, end: RANGE_END });
  const weeks = eachWeekOfInterval({ start: RANGE_START, end: RANGE_END }, { weekStartsOn: 1 }).filter((w) => w >= RANGE_START);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left - PAD_X;
    setFocus(Math.min(Math.max((x / (width - PAD_X * 2)) * TOTAL_DAYS, 0), TOTAL_DAYS));
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {(Object.keys(DOT_CLASSES) as EventStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', DOT_CLASSES[s])} />
            {STATUS_LABELS[s]}
          </span>
        ))}
        <span>Numbers on the line are Mondays</span>
        <span className="ml-auto">Hover the line to zoom in</span>
      </div>

      <div ref={boxRef} className="scrollbar-thin overflow-x-auto border border-border bg-muted/10">
        <div
          className="relative"
          style={{ width, height: TRACK_HEIGHT }}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setFocus(null)}
        >
          {/* Month bands */}
          {months.map((m, i) => {
            const start = i === 0 ? RANGE_START : m;
            const next = months[i + 1] ?? addDays(RANGE_END, 1);
            const left = scale(dayOf(start));
            return (
              <div
                key={m.toISOString()}
                className={cn('absolute inset-y-0 overflow-hidden border-l border-border/70', MOVE, i % 2 === 1 && 'bg-muted/30')}
                style={{ left, width: scale(dayOf(next)) - left }}
              >
                <span className="absolute left-2 top-2 whitespace-nowrap font-serif text-sm font-semibold text-foreground">
                  {format(m, 'MMMM')}
                  {(i === 0 || m.getMonth() === 0) && <span className="ml-1 font-sans text-[11px] font-normal text-muted-foreground">{format(m, 'yyyy')}</span>}
                </span>
              </div>
            );
          })}

          {/* The line */}
          <div className="absolute h-0.5 bg-foreground/70" style={{ left: PAD_X, right: PAD_X, top: LINE_Y - 1 }} />

          {/* Week ticks with Monday dates */}
          {weeks.map((w) => (
            <div key={w.toISOString()} className={cn('absolute flex flex-col items-center', MOVE)} style={{ left: scale(dayOf(w) + 0.5), top: LINE_Y + 2, transform: 'translateX(-50%)' }}>
              <span className="h-2 w-px bg-foreground/50" />
              <span className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">{format(w, 'd')}</span>
            </div>
          ))}

          {/* Today */}
          {todayInRange && (
            <div className={cn('pointer-events-none absolute w-px border-l border-dashed border-destructive', MOVE)} style={{ left: scale(dayOf(today) + 0.5), top: 28, bottom: 8 }}>
              <span className="absolute -translate-x-1/2 bg-destructive px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-destructive-foreground" style={{ top: LINE_Y + 34 - 28 }}>
                Today
              </span>
            </div>
          )}

          {/* Events */}
          {placed.map(({ event, x, lane }) => {
            const labelTop = lane === null ? LINE_Y - DOT / 2 : LABEL_TOP + (LANES - 1 - lane) * LANE_HEIGHT;
            const status = event.status ?? 'scheduled';
            return (
              <HoverCard key={event.id} openDelay={80} closeDelay={60}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(event)}
                    aria-label={`${event.title}, ${formatEventDate(event, 'MMM d')}`}
                    className={cn('group absolute flex flex-col items-start hover:!z-20 focus:outline-none focus-visible:!z-20', MOVE)}
                    // Labels nearer the line sit on top, so taller stems pass behind them
                    style={{ left: x - DOT / 2, top: labelTop, height: LINE_Y + DOT / 2 - labelTop, zIndex: LANES - (lane ?? 0) }}
                  >
                    {lane !== null && (
                      <span className="max-w-[180px] truncate border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium leading-tight text-foreground shadow-sm transition-colors group-hover:border-primary group-hover:text-primary group-focus-visible:border-primary">
                        {event.title}
                      </span>
                    )}
                    <span className="ml-[5.5px] w-px flex-1 bg-border group-hover:bg-primary" />
                    <span
                      className={cn(
                        'h-3 w-3 shrink-0 rounded-full ring-2 ring-background transition-transform group-hover:scale-150 group-focus-visible:scale-150',
                        DOT_CLASSES[status]
                      )}
                    />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent side="top" style={{ borderRadius: 0 }} className="w-96 border-border p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" style={{ borderRadius: 0 }} className="text-[10px] uppercase tracking-wider">
                      Event
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[status]}</Badge>
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
        </div>
      </div>
    </div>
  );
}
