import { useState } from 'react';
import { format, parseISO, isSameDay, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  CalendarDays,
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

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Calendar & Events
          </h1>
          <p className="mt-1 text-muted-foreground">
            View and manage all society events and schedules.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Calendar Grid */}
        <Card className="lg:col-span-3 border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">
                {format(currentDate, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={handlePrevMonth} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dayEvents = eventsForDay(day);
                const inMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());
                const isSelected =
                  selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      'relative flex min-h-[64px] flex-col items-center rounded-lg border p-1.5 text-sm transition-all sm:min-h-[80px]',
                      inMonth
                        ? 'border-border bg-card hover:border-primary'
                        : 'border-transparent bg-muted/30 text-muted-foreground',
                      isSelected && 'border-primary ring-1 ring-primary',
                      isToday && 'border-primary'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        isToday && 'bg-primary text-primary-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="mt-1 hidden flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                        {dayEvents.slice(0, 2).map((e) => (
                          <div
                            key={e.id}
                            className="truncate rounded bg-primary/15 px-1 py-0.5 text-[0.65rem] text-primary"
                          >
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="px-1 text-[0.65rem] text-muted-foreground">
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                    {dayEvents.length > 0 && (
                      <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary sm:hidden" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Event Flow List */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Event Flow
            </CardTitle>
            <CardDescription>
              {eventsThisMonth.length} events in {format(currentDate, 'MMMM')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[520px] pr-4">
              <ol className="relative space-y-1">
                {sortedEvents.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No events this month.
                  </p>
                )}
                {sortedEvents.map((event, idx) => {
                  const start = parseISO(event.start);
                  const end = parseISO(event.end);
                  return (
                    <li key={event.id} className="relative flex gap-4 pb-4">
                      {/* Timeline line */}
                      {idx < sortedEvents.length - 1 && (
                        <span className="absolute left-[15px] top-8 h-full w-px bg-border" />
                      )}
                      {/* Timeline dot */}
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      </span>
                      {/* Event card */}
                      <div className="flex-1 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary">
                        <p className="text-sm font-semibold">{event.title}</p>
                        <div className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {format(start, 'EEE, MMM d')} ·{' '}
                            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {event.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ScrollArea>
          </CardContent>
        </Card>
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

    // Reset form
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
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Create New Event
          </DialogTitle>
          <DialogDescription>
            Add a new event to the society calendar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-name">Event Name</Label>
            <Input
              id="event-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Introduction to Python Workshop"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
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
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time</Label>
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

          <div className="space-y-2">
            <Label htmlFor="event-location">Location (optional)</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Engineering Building, Room 204"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Description / Flow</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the event agenda and details..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create Event</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
