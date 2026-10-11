import { useState } from 'react';
import { CalendarDays, ChevronDown, Clock, ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
import { AddEventDialog } from '@/components/AddEventDialog';
import { EpfPanel } from '@/components/EpfPanel';
import { SectionHeader } from '@/components/SectionHeader';
import { EventDetailsEditor } from '@/components/views/EventsView';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/hooks/use-toast';
import { formatEventDateRange, formatEventTimeRange, isTba, STAGES } from '@/lib/eventDates';
import type { Event, EventStatus } from '@/lib/types';

const STATUS_LABELS: Record<EventStatus, string> = { scheduled: 'Not started', 'planning-in-progress': 'In progress', done: 'Done' };

/** One sub-event: when/where, its stage, edit, remove, and its EPF. */
function SubEventRow({ event, canDelete, onDelete }: { event: Event; canDelete: boolean; onDelete: () => void }) {
  const { saveEvent } = useEvents();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [epfOpen, setEpfOpen] = useState(false);

  const moveTo = (stage: string) =>
    saveEvent(event.id, { stage: stage || null }).catch((err: unknown) =>
      toast({ title: "Couldn't move the sub-event", description: (err as Error).message, variant: 'destructive' })
    );

  return (
    <article className="space-y-2 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h4 className="text-sm font-medium">{event.title}</h4>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatEventDateRange(event, 'EEE, MMM d, yyyy')}
            </span>
            {!isTba(event) && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatEventTimeRange(event)}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
            )}
            {event.status && <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[event.status]}</Badge>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <select
            value={event.stage ?? ''}
            onChange={(e) => moveTo(e.target.value)}
            aria-label={`Stage of ${event.title}`}
            className="h-7 border border-border bg-background px-1.5 text-xs text-muted-foreground focus:border-primary focus:outline-none"
          >
            <option value="">No stage</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {event.notionUrl && (
            <a href={event.notionUrl} target="_blank" rel="noopener noreferrer" title="Open in Notion" aria-label={`Open ${event.title} in Notion`} className="p-1 text-muted-foreground transition-colors hover:text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button type="button" title="Edit" aria-label={`Edit ${event.title}`} onClick={() => setEditing((v) => !v)} className="p-1 text-muted-foreground transition-colors hover:text-primary">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {canDelete && (
            <button type="button" title="Remove" aria-label={`Remove ${event.title}`} onClick={onDelete} className="p-1 text-muted-foreground transition-colors hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {editing && <EventDetailsEditor event={event} onDone={() => setEditing(false)} />}
      <button
        type="button"
        onClick={() => setEpfOpen((o) => !o)}
        aria-expanded={epfOpen}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', !epfOpen && '-rotate-90')} />
        EPF
      </button>
      {epfOpen && (
        <div className="border-l-2 border-border pl-3">
          <EpfPanel eventId={event.id} />
        </div>
      )}
    </article>
  );
}

/** A project's sub-events grouped by stage. Each is an Events row (Notion `Project` set), so it shows in Events too. */
export function SubEvents({ project, subEvents }: { project: string; subEvents: Event[] }) {
  const { createEvent, deleteEvent, canDelete } = useEvents();
  const { toast } = useToast();
  const [addingTo, setAddingTo] = useState<string | null | undefined>(undefined); // undefined = dialog closed
  const [removing, setRemoving] = useState<Event | null>(null);
  const [removePending, setRemovePending] = useState(false);

  const unstaged = subEvents.filter((e) => !e.stage || !STAGES.includes(e.stage));
  const groups: { stage: string | null; events: Event[] }[] = [
    ...STAGES.map((stage) => ({ stage, events: subEvents.filter((e) => e.stage === stage) })),
    ...(unstaged.length ? [{ stage: null, events: unstaged }] : []),
  ];

  const handleRemove = async () => {
    if (!removing) return;
    setRemovePending(true);
    try {
      await deleteEvent(removing.id);
      toast({ title: 'Sub-event removed', description: `"${removing.title}" was moved to Notion's trash.` });
      setRemoving(null);
    } catch (err) {
      toast({ title: "Couldn't remove the sub-event", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setRemovePending(false);
    }
  };

  return (
    <div className="space-y-8">
      <p className="text-xs text-muted-foreground">Sub-events are saved to Notion's Events, so they show in the Events tab as well.</p>
      {groups.map(({ stage, events }) => (
        <section key={stage ?? 'none'}>
          <SectionHeader
            title={stage ?? 'No stage'}
            meta={`${events.length}`}
            action={
              stage && (
                <button type="button" onClick={() => setAddingTo(stage)} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary">
                  <Plus className="h-3 w-3" />
                  Add sub-event
                </button>
              )
            }
          />
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sub-events in this stage.</p>
          ) : (
            <div className="divide-y divide-border">
              {events.map((e) => (
                <SubEventRow key={e.id} event={e} canDelete={canDelete} onDelete={() => setRemoving(e)} />
              ))}
            </div>
          )}
        </section>
      ))}

      <AddEventDialog
        open={addingTo !== undefined}
        onOpenChange={(open) => !open && setAddingTo(undefined)}
        onCreate={(input) => createEvent({ ...input, project, stage: addingTo ?? undefined })}
      />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && !removePending && setRemoving(null)}>
        <AlertDialogContent style={{ borderRadius: 0 }} className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold">Remove sub-event</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              &ldquo;{removing?.title}&rdquo; will be moved to Notion&apos;s trash and disappear from Events too. It can be restored from the trash in Notion for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel style={{ borderRadius: 0 }} disabled={removePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ borderRadius: 0 }}
              disabled={removePending}
              onClick={(e) => {
                // Keep the dialog open until Notion confirms
                e.preventDefault();
                void handleRemove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removePending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
