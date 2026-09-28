import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CalendarPlus, Clock, MapPin, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMeetings } from '@/hooks/useMeetings';
import { formatEventDate, formatEventTimeRange, isTba } from '@/lib/eventDates';
import { EventOverview } from '@/components/EventOverview';
import { TbaTag } from '@/components/TbaTag';
import { MonthCalendar, ViewModeToggle } from '@/components/MonthCalendar';
import type { Meeting } from '@/lib/types';

const MEETING_CHIP_CLASSES = 'border-sky-500/30 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-400';

/** Date, time, venue and type on one line. */
function MeetingMeta({ meeting, datePattern }: { meeting: Meeting; datePattern: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {isTba(meeting) ? <TbaTag /> : <span>{formatEventDate(meeting, datePattern)}</span>}
      {!isTba(meeting) && (
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          {formatEventTimeRange(meeting)}
        </span>
      )}
      {meeting.location && (
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 shrink-0" />
          {meeting.location}
        </span>
      )}
      {meeting.type && (
        <span className="border border-sky-500/30 px-1 text-[10px] uppercase tracking-wider text-sky-700 dark:text-sky-400">
          {meeting.type}
        </span>
      )}
    </span>
  );
}

/**
 * Meetings from Notion: upcoming ones first, then the minutes of past ones
 * (a meeting moves across once it's over). Optionally a month calendar.
 */
export function MeetingsView() {
  const { upcoming, past, data: allMeetings, isLoading, error, canCreate } = useMeetings();
  const [mode, setMode] = useState<'list' | 'calendar'>('list');
  const [openMeeting, setOpenMeeting] = useState<Meeting | null>(null);
  const [creating, setCreating] = useState(false);

  // Minutes: default to the most recent past meeting
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = past.find((m) => m.id === selectedId) ?? past[0] ?? null;

  return (
    <div className="space-y-10">
      <header className="border-b border-border pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Meetings</h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              What's coming up, and the minutes from every meeting so far, from Notion.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ViewModeToggle mode={mode} onChange={setMode} />
            {canCreate && (
              <button
                onClick={() => setCreating(true)}
                style={{ borderRadius: 0 }}
                className="flex items-center gap-2 border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                New meeting
              </button>
            )}
          </div>
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn't load meetings — try refreshing.</span>
        </div>
      ) : mode === 'calendar' ? (
        <MonthCalendar
          items={allMeetings}
          isLoading={isLoading}
          onSelect={setOpenMeeting}
          chipClassName={() => MEETING_CHIP_CLASSES}
          noun="meetings"
        />
      ) : (
        <>
          {/* ── Upcoming Meetings ─────────────────────────────────────── */}
          <section>
            <div className="mb-2 flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-xl font-semibold">Upcoming Meetings</h2>
              <span className="text-xs text-muted-foreground">{isLoading ? 'Loading...' : upcoming.length}</span>
            </div>
            {isLoading ? (
              <div className="space-y-3 py-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">No upcoming meetings.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setOpenMeeting(m)}
                      className="group w-full py-3 text-left transition-colors hover:bg-muted/10 sm:px-3"
                    >
                      <span className="block font-serif text-base font-semibold group-hover:text-primary">{m.title}</span>
                      <span className="mt-1 block">
                        <MeetingMeta meeting={m} datePattern="EEEE, MMMM d, yyyy" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Meeting Minutes (past meetings, newest first) ─────────── */}
          <section>
            <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-xl font-semibold">Meeting Minutes</h2>
              <span className="text-xs text-muted-foreground">{isLoading ? 'Loading...' : past.length}</span>
            </div>
            {isLoading ? (
              <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
                <div className="space-y-2.5">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            ) : past.length === 0 ? (
              <p className="text-xs text-muted-foreground">No past meetings yet.</p>
            ) : (
              <div className="grid gap-10 lg:grid-cols-[18rem_1fr] lg:gap-12">
                <nav aria-label="Past meetings">
                  <ul className="divide-y divide-border lg:max-h-[70vh] lg:overflow-y-auto lg:scrollbar-thin">
                    {past.map((m) => {
                      const active = m.id === selected?.id;
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
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {formatEventDate(m, 'EEE, MMM d, yyyy')}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                {selected && (
                  <article className="min-w-0">
                    <div className="border-b border-border pb-3">
                      <h3 className="font-serif text-2xl font-semibold">{selected.title}</h3>
                      <div className="mt-1.5">
                        <MeetingMeta meeting={selected} datePattern="EEEE, MMMM d, yyyy" />
                      </div>
                    </div>
                    <div className="pt-5">
                      <EventOverview key={selected.id} eventId={selected.id} notionUrl={selected.notionUrl} />
                    </div>
                  </article>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── One meeting (from Upcoming or the calendar) ─────────────── */}
      <Dialog open={openMeeting !== null} onOpenChange={(open) => !open && setOpenMeeting(null)}>
        {openMeeting && (
          <DialogContent style={{ borderRadius: 0 }} className="max-h-[90vh] max-w-xl overflow-y-auto border-border">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-semibold">{openMeeting.title}</DialogTitle>
              <DialogDescription asChild>
                <div>
                  <MeetingMeta meeting={openMeeting} datePattern="EEEE, MMMM d, yyyy" />
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="min-w-0 border-t border-border pt-4 text-sm">
              <EventOverview key={openMeeting.id} eventId={openMeeting.id} notionUrl={openMeeting.notionUrl} />
            </div>
          </DialogContent>
        )}
      </Dialog>

      <NewMeetingDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NewMeetingDialog — President, Vice President, Secretary and Head of Tech
// ─────────────────────────────────────────────────────────────────────────────

function NewMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createMeeting } = useMeetings();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setDate('');
    setTime('');
    setNotes('');
  };

  const handleOpenChange = (next: boolean) => {
    if (saving) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const canSave = title.trim() !== '' && date !== '' && time !== '' && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await createMeeting({ title: title.trim(), date, time, notes: notes.trim() || undefined });
      toast({ title: 'Meeting added', description: 'Saved to the Meetings database in Notion.' });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Couldn't add meeting", description: (err as Error).message, variant: 'destructive' });
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
            New meeting
          </DialogTitle>
          <DialogDescription className="text-xs">
            Saved to the Meetings database in Notion. Notes go on the meeting's page, where the minutes are written.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="meeting-title" className="text-xs">Title *</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Meeting"
              maxLength={200}
              style={{ borderRadius: 0 }}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="meeting-date" className="text-xs">Date *</Label>
              <Input id="meeting-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ borderRadius: 0 }} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meeting-time" className="text-xs">Time * <span className="text-muted-foreground">(Malaysia)</span></Label>
              <Input id="meeting-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ borderRadius: 0 }} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meeting-notes" className="text-xs">
              Notes <span className="text-muted-foreground">(optional, e.g. the agenda)</span>
            </Label>
            <textarea
              id="meeting-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              maxLength={20000}
              style={{ borderRadius: 0 }}
              className="w-full resize-y border border-input bg-background p-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" style={{ borderRadius: 0 }} onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" style={{ borderRadius: 0 }} disabled={!canSave}>
              {saving ? 'Saving…' : 'Add meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
