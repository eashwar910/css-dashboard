import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { NewEvent } from '@/hooks/useEvents';
import { MAX_EPF_BYTES, useEpfs } from '@/hooks/useEpfs';
import type { Event, EventStatus } from '@/lib/types';

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewEvent) => Promise<Event>;
}

/** Same wording as Notion's Status options, since that's where it's saved. */
const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'scheduled', label: 'Not started' },
  { value: 'planning-in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

/** "2026-10-01" + "18:30" → "2026-10-01T18:30:00+08:00", using this browser's timezone on that date. */
function toOffsetDateTime(date: string, time: string): string {
  const offsetMin = -new Date(`${date}T${time}:00`).getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${date}T${time}:00${sign}${hh}:${mm}`;
}

/** Create an event in the Notion Events database. */
export function AddEventDialog({ open, onOpenChange, onCreate }: AddEventDialogProps) {
  const { toast } = useToast();
  const { uploadEpf } = useEpfs();
  const [title, setTitle] = useState('');
  const [tba, setTba] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<EventStatus>('scheduled');
  const [epfFile, setEpfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setTba(false);
    setAllDay(false);
    setStartDate('');
    setStartTime('18:00');
    setEndDate('');
    setEndTime('');
    setLocation('');
    setStatus('scheduled');
    setEpfFile(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (saving) return;
    if (!next) reset();
    onOpenChange(next);
  };

  /** Build Notion's start/end, or an error message for the form. */
  const timeline = ((): { start: string | null; end: string | null } | string => {
    if (tba) return { start: null, end: null };
    if (!startDate) return 'Pick a start date, or mark the date as TBA.';
    if (allDay) {
      if (endDate && endDate < startDate) return 'The end date is before the start date.';
      return { start: startDate, end: endDate && endDate !== startDate ? endDate : null };
    }
    if (!startTime) return 'Pick a start time, or tick "All day".';
    const start = toOffsetDateTime(startDate, startTime);
    // An end time with no end date means the same day
    if (!endTime && !endDate) return { start, end: null };
    if (!endTime) return 'Pick an end time too.';
    const end = toOffsetDateTime(endDate || startDate, endTime);
    if (Date.parse(end) <= Date.parse(start)) return 'The end is before the start.';
    return { start, end };
  })();

  const timelineError = typeof timeline === 'string' ? timeline : null;
  const epfTooBig = epfFile !== null && epfFile.size > MAX_EPF_BYTES;
  const canSave = title.trim() !== '' && timelineError === null && !epfTooBig && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || typeof timeline === 'string') return;
    setSaving(true);
    try {
      const event = await onCreate({ title: title.trim(), ...timeline, location: location.trim() || null, status });
      if (epfFile) {
        try {
          await uploadEpf(event.id, epfFile);
        } catch (err) {
          // The event exists now; the EPF can be uploaded again from the event itself
          toast({
            title: "Event added, but the EPF didn't upload",
            description: `${(err as Error).message} Open the event to try again.`,
            variant: 'destructive',
          });
          reset();
          onOpenChange(false);
          return;
        }
      }
      toast({
        title: 'Event added',
        description: epfFile ? 'Saved to Notion with its EPF.' : 'Saved to the Events database in Notion.',
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Couldn't add event", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent style={{ borderRadius: 0 }} className="max-h-[90vh] max-w-lg overflow-y-auto border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl font-semibold">
            <CalendarPlus className="h-4 w-4 text-primary" />
            Add event
          </DialogTitle>
          <DialogDescription className="text-xs">
            Saved to the Events database in Notion, so it shows up in Calendar, Events and Home.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="event-title" className="text-xs">Event name *</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Hackathon Kickoff"
              maxLength={200}
              style={{ borderRadius: 0 }}
              required
            />
          </div>

          {/* When */}
          <fieldset className="space-y-3">
            <legend className="mb-1.5 text-xs font-medium">When</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox checked={tba} onCheckedChange={(v) => setTba(v === true)} />
                Date TBA
              </label>
              <label className={cn('flex items-center gap-2 text-xs', tba ? 'opacity-50' : 'cursor-pointer')}>
                <Checkbox checked={allDay} disabled={tba} onCheckedChange={(v) => setAllDay(v === true)} />
                All day
              </label>
            </div>

            {!tba && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-start-date" className="text-xs">Start date *</Label>
                  <Input
                    id="event-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ borderRadius: 0 }}
                  />
                </div>
                {!allDay ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="event-start-time" className="text-xs">Start time *</Label>
                    <Input
                      id="event-start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      style={{ borderRadius: 0 }}
                    />
                  </div>
                ) : (
                  <div />
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="event-end-date" className="text-xs">
                    End date <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="event-end-date"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ borderRadius: 0 }}
                  />
                </div>
                {!allDay && (
                  <div className="space-y-1.5">
                    <Label htmlFor="event-end-time" className="text-xs">
                      End time <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="event-end-time"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      style={{ borderRadius: 0 }}
                    />
                  </div>
                )}
              </div>
            )}
            {timelineError && (startDate || endDate || endTime) && (
              <p className="text-[11px] text-destructive">{timelineError}</p>
            )}
          </fieldset>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="event-location" className="text-xs">
              Location <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. F4B09a, or Online"
              maxLength={200}
              style={{ borderRadius: 0 }}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Status</p>
            <div className="flex w-fit items-center border border-border">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    status === option.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={status === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* EPF */}
          <div className="space-y-1.5">
            <Label htmlFor="event-epf" className="text-xs">
              EPF <span className="text-muted-foreground">(optional, can be added later)</span>
            </Label>
            <Input
              id="event-epf"
              type="file"
              onChange={(e) => setEpfFile(e.target.files?.[0] ?? null)}
              style={{ borderRadius: 0 }}
              className="h-9 text-xs file:mr-3 file:text-xs"
            />
            <p className={cn('text-[11px]', epfTooBig ? 'text-destructive' : 'text-muted-foreground')}>
              {epfTooBig ? 'That file is over 4 MB.' : 'Up to 4 MB. Saved to Event Planning Forms in Notion, linked to this event.'}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" style={{ borderRadius: 0 }} onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" style={{ borderRadius: 0 }} disabled={!canSave}>
              {saving ? 'Saving…' : 'Add event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
