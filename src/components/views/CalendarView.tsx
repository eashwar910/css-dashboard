import { useState } from 'react';
import {
  format, parseISO, isSameDay, isSameMonth,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
} from 'lucide-react';
import { monthlyEvents, type EventItem } from '@/data/mockData';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHourLabel(h: number) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1));
  const [events, setEvents] = useState<EventItem[]>(monthlyEvents);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsThisMonth = events.filter((e) =>
    isSameMonth(parseISO(e.start), currentDate)
  );

  const eventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.start), day));

  const sortedEvents = [...eventsThisMonth].sort(
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
  );

  const handlePrevMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const handleNextMonth = () => setCurrentDate((d) => addMonths(d, 1));
  const handleToday = () => setCurrentDate(new Date(2026, 8, 1));

  const eventsForSelected = selectedDate ? eventsForDay(selectedDate) : [];

  return (
    <div className="space-y-14">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <header className="border-b border-border pb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">
              Calendar &amp; Events
            </h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              View and manage all society events and schedules.
            </p>
          </div>
          {/* Plain bordered button — no fill, no rounded */}
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add event
          </button>
        </div>
      </header>

      {/* ── Grid: calendar + event list ──────────────────────────────── */}
      <div className="grid gap-12 lg:grid-cols-5">

        {/* ── Monthly calendar — typeset grid ──────────────────────── */}
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

          {/* Calendar day cells — hairline grid, no rounded, no shadows */}
          <div className="grid grid-cols-7 border-l border-border">
            {days.map((day) => {
              const dayEvents = eventsForDay(day);
              const inMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(isSelected ? null : day)}
                  className={cn(
                    'relative flex min-h-[72px] flex-col border-b border-r border-border p-1.5 text-left transition-colors sm:min-h-[88px]',
                    inMonth ? 'bg-background' : 'bg-muted/20',
                    !inMonth && 'text-muted-foreground',
                    isSelected && 'bg-primary/5',
                  )}
                >
                  {/* Day number */}
                  <span
                    className={cn(
                      'inline-block text-xs font-medium leading-none',
                      isToday && 'font-bold text-primary underline underline-offset-2',
                      isSelected && !isToday && 'text-primary'
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Event chips — flat text, no rounded pill */}
                  {dayEvents.length > 0 && (
                    <div className="mt-1 hidden flex-col gap-px overflow-hidden sm:flex">
                      {dayEvents.slice(0, 2).map((e) => (
                        <div
                          key={e.id}
                          className="truncate bg-primary/10 px-1 py-px text-[0.6rem] leading-tight text-primary"
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="px-1 text-[0.6rem] text-muted-foreground">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                  {/* Mobile dot */}
                  {dayEvents.length > 0 && (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 bg-primary sm:hidden" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected-day detail — appears below calendar, no card */}
          {selectedDate && (
            <div className="border-t border-border mt-0 pt-4">
              <p className="mb-3 text-xs text-muted-foreground">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </p>
              {eventsForSelected.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events on this day.</p>
              ) : (
                <div className="divide-y divide-border">
                  {eventsForSelected.map((e) => {
                    const s = parseISO(e.start);
                    return (
                      <div key={e.id} className="py-3">
                        <p className="text-sm font-medium">{e.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(s, 'h:mm a')} – {format(parseISO(e.end), 'h:mm a')}
                          {e.location && ` · ${e.location}`}
                        </p>
                        {e.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {e.description}
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

        {/* ── Event list (chronological) ───────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="font-serif text-lg font-semibold">Event Schedule</h2>
            <span className="text-xs text-muted-foreground">
              {eventsThisMonth.length} in {format(currentDate, 'MMMM')}
            </span>
          </div>

          <ScrollArea className="h-[560px] scrollbar-thin">
            {sortedEvents.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">No events this month.</p>
            ) : (
              <div className="divide-y divide-border">
                {sortedEvents.map((event) => {
                  const start = parseISO(event.start);
                  const end = parseISO(event.end);
                  return (
                    <article key={event.id} className="py-4 pr-2">
                      {/* Date as section header */}
                      <p className="mb-1 text-xs text-muted-foreground">
                        {format(start, 'EEE, MMM d')}
                      </p>
                      <p className="font-serif text-base font-semibold leading-snug">
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
                      </div>
                      {event.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <CreateEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={(event) => setEvents((prev) => [...prev, event])}
      />
    </div>
  );
}

function CreateEventDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (event: EventItem) => void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !startTime) return;

    const start = `${startDate}T${startTime}:00`;
    const end = `${endDate || startDate}T${endTime || startTime}:00`;

    onAdd({
      id: `evt-${Date.now()}`,
      title: name,
      start,
      end,
      description,
      location: location || undefined,
    });

    setName('');
    setStartDate('');
    setStartTime('');
    setEndDate('');
    setEndTime('');
    setDescription('');
    setLocation('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-semibold flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-primary" />
            New Event
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Add a new event to the society calendar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="event-name" className="text-xs">Event Name</Label>
            <Input
              id="event-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Introduction to Python Workshop"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-xs">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start-time" className="text-xs">Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="start-time">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h).padStart(2, '0') + ':00'}>
                      {formatHourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-xs">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-time" className="text-xs">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="end-time">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h).padStart(2, '0') + ':00'}>
                      {formatHourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-location" className="text-xs">Location (optional)</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Engineering Building, Room 204"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description" className="text-xs">Description</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the event agenda and details..."
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-sm"
            >
              Cancel
            </Button>
            <Button type="submit" className="text-sm">
              Create Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
