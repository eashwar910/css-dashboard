import { useEffect, useMemo, useRef } from 'react';
import { addDays, differenceInCalendarDays, eachMonthOfInterval, eachWeekOfInterval, format, startOfDay } from 'date-fns';
import { CalendarDays, Clock, FileCheck2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { DetailFacts } from '@/components/DetailFacts';
import type { Event, EventStatus } from '@/lib/types';
import { eventStart, formatEventDate, formatEventTimeRange } from '@/lib/eventDates';

// ─────────────────────────────────────────────────────────────────────────────
// EventTimeline
//
// The academic year (Sep 15 2026 – May 31 2027) as one horizontal line, with a
// dot per dated event. Hovering or focusing a dot shows the event's details;
// clicking opens the full event dialog. TBA events have no place on the line.
// ─────────────────────────────────────────────────────────────────────────────

const RANGE_START = new Date(2026, 8, 15);
const RANGE_END = new Date(2027, 4, 31);
const TOTAL_DAYS = differenceInCalendarDays(RANGE_END, RANGE_START) + 1;

const PX_PER_DAY = 8;
const PAD_X = 24;
const TRACK_WIDTH = TOTAL_DAYS * PX_PER_DAY + PAD_X * 2;

/** Title labels stack in lanes above the line so they don't overlap. */
const LANES = 5;
const LANE_HEIGHT = 24;
const LINE_Y = 24 + LANES * LANE_HEIGHT + 16;
const TRACK_HEIGHT = LINE_Y + 56;
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

function xFor(date: Date) {
  return PAD_X + differenceInCalendarDays(date, RANGE_START) * PX_PER_DAY + PX_PER_DAY / 2;
}

interface Placed {
  event: Event;
  x: number;
  /** null when every lane is taken there; the dot is still shown. */
  lane: number | null;
}

/** Greedy lane assignment: each label takes the lowest lane that's free at its x. */
function place(events: Event[]): Placed[] {
  const laneEnds = new Array<number>(LANES).fill(-Infinity);
  const perDay = new Map<number, number>();
  return events.map((event) => {
    const day = differenceInCalendarDays(eventStart(event)!, RANGE_START);
    // Several events on one day sit side by side
    const nth = perDay.get(day) ?? 0;
    perDay.set(day, nth + 1);
    const x = PAD_X + day * PX_PER_DAY + PX_PER_DAY / 2 + nth * (DOT + 2);
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
  /** Events with an uploaded EPF, for the badge in the hover card. */
  hasEpf: (eventId: string) => boolean;
}

export function EventTimeline({ events, isLoading, onSelect, hasEpf }: EventTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());
  const todayInRange = today >= RANGE_START && today <= RANGE_END;

  const { placed, outside } = useMemo(() => {
    const dated = events.filter((e) => eventStart(e) !== null);
    const inRange = dated.filter((e) => {
      const d = startOfDay(eventStart(e)!);
      return d >= RANGE_START && d <= RANGE_END;
    });
    return { placed: place(inRange), outside: dated.length - inRange.length };
  }, [events]);

  const months = eachMonthOfInterval({ start: RANGE_START, end: RANGE_END });
  const weeks = eachWeekOfInterval({ start: RANGE_START, end: RANGE_END }, { weekStartsOn: 1 }).filter((w) => w >= RANGE_START);

  // Open scrolled to today (a third of the way in), else at the start
  useEffect(() => {
    const el = scrollRef.current;
    if (el && todayInRange) el.scrollLeft = Math.max(0, xFor(today) - el.clientWidth / 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const tbaCount = events.length - placed.length - outside;

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
        <span className="ml-auto">
          {format(RANGE_START, 'MMM d, yyyy')} – {format(RANGE_END, 'MMM d, yyyy')}
        </span>
      </div>

      <div ref={scrollRef} className="scrollbar-thin overflow-x-auto border border-border bg-muted/10">
        <div className="relative" style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT }}>
          {/* Month bands */}
          {months.map((m, i) => {
            const start = i === 0 ? RANGE_START : m;
            const next = months[i + 1] ?? addDays(RANGE_END, 1);
            return (
              <div
                key={m.toISOString()}
                className={cn('absolute inset-y-0 border-l border-border/70', i % 2 === 1 && 'bg-muted/30')}
                style={{ left: xFor(start) - PX_PER_DAY / 2, width: differenceInCalendarDays(next, start) * PX_PER_DAY }}
              >
                <span className="absolute left-2 top-2 font-serif text-sm font-semibold text-foreground">
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
            <div key={w.toISOString()} className="absolute flex flex-col items-center" style={{ left: xFor(w), top: LINE_Y + 2, transform: 'translateX(-50%)' }}>
              <span className="h-2 w-px bg-foreground/50" />
              <span className="mt-1 text-[10px] tabular-nums text-muted-foreground">{format(w, 'd')}</span>
            </div>
          ))}

          {/* Today */}
          {todayInRange && (
            <div className="pointer-events-none absolute w-px border-l border-dashed border-destructive" style={{ left: xFor(today), top: 28, bottom: 8 }}>
              <span className="absolute -translate-x-1/2 bg-destructive px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-destructive-foreground" style={{ top: LINE_Y + 30 - 28 }}>
                Today
              </span>
            </div>
          )}

          {/* Events */}
          {placed.map(({ event, x, lane }) => {
            const labelTop = lane === null ? LINE_Y - DOT / 2 : 32 + (LANES - 1 - lane) * LANE_HEIGHT;
            const status = event.status ?? 'scheduled';
            return (
              <HoverCard key={event.id} openDelay={80} closeDelay={60}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(event)}
                    aria-label={`${event.title}, ${formatEventDate(event, 'MMM d')}`}
                    className="group absolute flex flex-col items-start hover:!z-20 focus:outline-none focus-visible:!z-20"
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
                    {hasEpf(event.id) && (
                      <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <FileCheck2 className="mr-1 h-3 w-3" />
                        EPF
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-foreground">{event.title}</h3>
                  <div className="mt-3">
                    <DetailFacts
                      facts={[
                        { icon: CalendarDays, label: 'Date', value: formatEventDate(event, 'EEE, MMM d, yyyy') },
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

      {(tbaCount > 0 || outside > 0) && (
        <p className="text-xs text-muted-foreground">
          {[
            tbaCount > 0 && `${tbaCount} ${tbaCount === 1 ? 'event has' : 'events have'} no date yet`,
            outside > 0 && `${outside} ${outside === 1 ? 'event falls' : 'events fall'} outside this range`,
          ]
            .filter(Boolean)
            .join(' and ')}
          , so {tbaCount + outside === 1 ? "it isn't" : "they aren't"} on the timeline. See them in List.
        </p>
      )}
    </div>
  );
}
