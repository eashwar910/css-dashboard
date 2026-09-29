import { useState } from 'react';
import {
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { eventStart, formatEventTimeRange } from '@/lib/eventDates';

/** Anything with a title and an optional date: events and meetings. */
export interface CalendarItem {
  id: string;
  title: string;
  startDateTime?: string;
  endDateTime?: string;
  allDay?: boolean;
  location?: string;
}

interface MonthCalendarProps<T extends CalendarItem> {
  items: T[];
  isLoading: boolean;
  onSelect: (item: T) => void;
  /** Chip colour classes for an item. */
  chipClassName: (item: T) => string;
  /** e.g. "events" in "No events on this day." */
  noun: string;
}

/** Month grid with a selected-day list. Undated (TBA) items can't be placed, so they never appear. */
export function MonthCalendar<T extends CalendarItem>({ items, isLoading, onSelect, chipClassName, noun }: MonthCalendarProps<T>) {
  const [currentDate, setCurrentDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate)),
  });

  const itemsForDay = (day: Date) =>
    items.filter((item) => {
      const start = eventStart(item);
      return start !== null && isSameDay(start, day);
    });

  const itemsForSelected = selectedDate ? itemsForDay(selectedDate) : [];

  return (
    <div>
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <h2 className="font-serif text-xl font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentDate((d) => subMonths(d, 1))}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground dark:border-foreground/30 dark:bg-muted dark:text-foreground dark:hover:border-primary dark:hover:text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCurrentDate(startOfMonth(new Date()))}
            className="border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground dark:border-foreground/30 dark:bg-muted dark:text-foreground dark:hover:border-primary dark:hover:text-primary"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate((d) => addMonths(d, 1))}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground dark:border-foreground/30 dark:bg-muted dark:text-foreground dark:hover:border-primary dark:hover:text-primary"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-1.5 text-center text-[11px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 border-l border-border">
        {days.map((day) => {
          const dayItems = itemsForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate !== null && isSameDay(day, selectedDate);

          return (
            <div
              key={day.toISOString()}
              onClick={() => setSelectedDate(isSelected ? null : day)}
              className={cn(
                'relative flex min-h-[72px] cursor-pointer flex-col border-b border-r border-border p-1.5 text-left transition-colors sm:min-h-[88px]',
                inMonth ? 'bg-background' : 'bg-muted/20 text-muted-foreground',
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
              ) : dayItems.length > 0 ? (
                <div className="mt-1 hidden flex-col gap-1 overflow-hidden sm:flex">
                  {dayItems.slice(0, 2).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelect(item);
                      }}
                      className={cn(
                        'truncate border px-1 py-0.5 text-left text-[0.62rem] leading-tight transition-colors',
                        chipClassName(item)
                      )}
                    >
                      {item.title}
                    </button>
                  ))}
                  {dayItems.length > 2 && (
                    <span className="px-1 text-[0.6rem] text-muted-foreground">+{dayItems.length - 2} more</span>
                  )}
                </div>
              ) : null}

              {dayItems.length > 0 && !isLoading && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 bg-primary sm:hidden" />
              )}
            </div>
          );
        })}
      </div>

      {/* Selected-day detail */}
      {selectedDate && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs text-muted-foreground">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
          {isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ) : itemsForSelected.length === 0 ? (
            <p className="text-xs text-muted-foreground">No {noun} on this day.</p>
          ) : (
            <div className="divide-y divide-border">
              {itemsForSelected.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="cursor-pointer py-3 transition-colors hover:text-primary"
                >
                  <p className="font-serif text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatEventTimeRange(item)}
                    {item.location && ` · ${item.location}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** List / Calendar switch shown in the Events and Meetings headers. */
export function ViewModeToggle<M extends string = 'list' | 'calendar'>({
  mode,
  onChange,
  modes = ['list', 'calendar'] as unknown as readonly M[],
}: {
  mode: M;
  onChange: (mode: M) => void;
  modes?: readonly M[];
}) {
  return (
    <div className="flex border border-border dark:border-foreground/30" role="group" aria-label="View">
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          className={cn(
            'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
            mode === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground dark:text-foreground/80 dark:hover:text-primary'
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
