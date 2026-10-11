import { useState } from 'react';
import { AlertCircle, CalendarDays, Check, Clock, ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
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
import { DetailFacts } from '@/components/DetailFacts';
import { SectionHeader } from '@/components/SectionHeader';
import { PageBody } from '@/components/PageBody';
import { SubEvents } from '@/components/SubEvents';
import { ExternalRelationDialog } from '@/components/ExternalRelationDialog';
import { EventDetailsEditor, EventFinancePanel, EventStatusPicker, EventTodoPanel } from '@/components/views/EventsView';
import { useEvents } from '@/hooks/useEvents';
import { useExternalRelations, type ExternalRelation, type Project } from '@/hooks/useExternalRelations';
import { useToast } from '@/hooks/use-toast';
import { compareEvents, formatEventDateRange, formatEventTimeRange, isTba, STAGES } from '@/lib/eventDates';
import { formatRM } from '@/lib/money';
import type { Event } from '@/lib/types';


const TYPE_LABEL = { sponsor: 'Sponsor', partner: 'Partner', speaker: 'Speaker' } as const;

/** A sponsor's total: bounty plus ops, or null when neither is set. */
function sponsorTotal(r: ExternalRelation): number | null {
  return r.bountyMyr === null && r.opsMyr === null ? null : (r.bountyMyr ?? 0) + (r.opsMyr ?? 0);
}


/** Stage stepper: earlier stages read as done, the current one is filled. Click to move. */
export function StagePicker({ event }: { event: Event }) {
  const { saveEvent } = useEvents();
  const { toast } = useToast();
  const current = event.stage ? STAGES.indexOf(event.stage) : -1;

  const setStage = (stage: string | null) =>
    saveEvent(event.id, { stage }).catch((err: unknown) =>
      toast({ title: "Couldn't change the stage", description: (err as Error).message, variant: 'destructive' })
    );

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stage</span>
        {event.stage && (
          <button type="button" onClick={() => setStage(null)} className="text-[11px] text-muted-foreground transition-colors hover:text-foreground">
            Clear
          </button>
        )}
      </div>
      <ol className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage, i) => (
          <li key={stage}>
            <button
              type="button"
              aria-pressed={i === current}
              onClick={() => i !== current && setStage(stage)}
              className={cn(
                'flex h-full w-full items-center gap-1.5 border px-2.5 py-2 text-left text-xs transition-colors',
                i === current
                  ? 'border-primary bg-primary text-primary-foreground font-semibold'
                  : i < current
                    ? 'border-primary/40 text-primary hover:border-primary'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              )}
            >
              <span className="font-mono text-[10px] opacity-70">{i < current ? <Check className="h-3 w-3" /> : i + 1}</span>
              {stage}
            </button>
          </li>
        ))}
      </ol>
      {current === -1 && <p className="text-xs text-muted-foreground">No stage set yet.</p>}
    </div>
  );
}

/** Sponsors (and any partners or speakers) tagged with this project in External Relations. */
export function SponsorTracker({ project }: { project: Project }) {
  const { data: relations, isLoading, error, save, remove } = useExternalRelations();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalRelation | null>(null);
  const [deleting, setDeleting] = useState<ExternalRelation | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const rows = relations.filter((r) => r.project === project);
  const total = rows.reduce((sum, r) => sum + (sponsorTotal(r) ?? 0), 0);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await remove(deleting.id);
      toast({ title: 'Sponsor deleted', description: `"${deleting.name}" was moved to Notion's trash.` });
      setDeleting(null);
    } catch (err) {
      toast({ title: "Couldn't delete", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <section>
      <SectionHeader
        title="Sponsors"
        meta={isLoading ? 'Loading...' : `${rows.length} · ${formatRM(total)} total`}
        action={
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <Plus className="h-3 w-3" />
            Add sponsor
          </button>
        }
      />
      {error ? (
        <p className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Couldn't load sponsors — try refreshing.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : rows.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">No sponsors for {project} yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-2 font-semibold">Name</th>
                <th className="px-2 py-2 text-right font-semibold">Bounty</th>
                <th className="px-2 py-2 text-right font-semibold">Ops</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="w-24 px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const rowTotal = sponsorTotal(r);
                return (
                  <tr key={r.id}>
                    <td className="px-2 py-2.5">
                      <span className="font-medium">{r.name}</span>
                      {r.type && r.type !== 'sponsor' && <span className="ml-2 text-[11px] text-muted-foreground">{TYPE_LABEL[r.type]}</span>}
                      {r.type !== 'sponsor' && r.valueProvided && <p className="mt-0.5 text-xs text-muted-foreground">{r.valueProvided}</p>}
                    </td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground">{r.bountyMyr === null ? '—' : formatRM(r.bountyMyr)}</td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground">{r.opsMyr === null ? '—' : formatRM(r.opsMyr)}</td>
                    <td className="px-2 py-2.5 text-right font-medium">{rowTotal === null ? '—' : formatRM(rowTotal)}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <a href={r.url} target="_blank" rel="noopener noreferrer" title="Open in Notion" aria-label={`Open ${r.name} in Notion`} className="p-1 text-muted-foreground transition-colors hover:text-primary">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          title="Edit"
                          aria-label={`Edit ${r.name}`}
                          onClick={() => {
                            setEditing(r);
                            setDialogOpen(true);
                          }}
                          className="p-1 text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" title="Delete" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)} className="p-1 text-muted-foreground transition-colors hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ExternalRelationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        relation={editing}
        // New rows are tagged with this project; edits leave the tag alone
        onSave={(input, id) => save(id ? input : { ...input, project }, id)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && !deletePending && setDeleting(null)}>
        <AlertDialogContent style={{ borderRadius: 0 }} className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold">Delete sponsor</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              &ldquo;{deleting?.name}&rdquo; will be moved to Notion&apos;s trash. It can be restored from the trash in Notion for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel style={{ borderRadius: 0 }} disabled={deletePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ borderRadius: 0 }}
              disabled={deletePending}
              onClick={(e) => {
                // Keep the dialog open until Notion confirms
                e.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/**
 * One page for a flagship event (NottsHack; Gilbot has GilbotView): its Events row (status,
 * stage, overview, to-dos, finance) plus its sponsors from External Relations, and
 * sub-events by stage (each with its EPF).
 */
export function FlagshipView({ project, match, blurb }: { project: Project; match: RegExp; blurb: string }) {
  const { data: events, isLoading, error, createEvent } = useEvents();
  const { toast } = useToast();
  const [editingDetails, setEditingDetails] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'overview' | 'subevents'>('overview');

  // shortcut: the event is found by name; if several match (e.g. NottsHack'27 and '28), the first not done wins.
  // Its sub-events (Project set) never count, even when their names match.
  const matches = events.filter((e) => !e.project && match.test(e.title));
  const event = matches.find((e) => e.status !== 'done') ?? matches[matches.length - 1];
  const subEvents = events.filter((e) => e.project === project).sort(compareEvents);

  const create = async () => {
    setCreating(true);
    try {
      await createEvent({ title: project, start: null, end: null, location: null, status: 'scheduled' });
    } catch (err) {
      toast({ title: "Couldn't create the event", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6">
        <div className="flex items-start gap-2">
          <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">{event?.title ?? project}</h1>
          {event && !editingDetails && (
            <button
              type="button"
              title="Edit name, date, time and location"
              aria-label="Edit name, date, time and location"
              onClick={() => setEditingDetails(true)}
              className="mt-2 p-1 text-muted-foreground transition-colors hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {event?.notionUrl && (
            <a href={event.notionUrl} target="_blank" rel="noopener noreferrer" title="Open in Notion" aria-label="Open in Notion" className="mt-2 p-1 text-muted-foreground transition-colors hover:text-primary">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">{blurb}</p>
      </header>

      {error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn't load events — try refreshing.</span>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : !event ? (
        <div className="space-y-3 border border-dashed border-border p-6 text-sm">
          <p className="text-muted-foreground">There's no {project} event in Notion's Events yet.</p>
          <button
            type="button"
            onClick={create}
            disabled={creating}
            style={{ borderRadius: 0 }}
            className="flex items-center gap-2 border border-border bg-background px-4 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {creating ? 'Creating…' : `Create the ${project} event`}
          </button>
        </div>
      ) : (
        <>
          <div className="flex border-b border-border">
            {(['overview', 'subevents'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2 text-xs font-semibold tracking-wide transition-colors',
                  tab === t ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'overview' ? 'Overview' : `Sub-events (${subEvents.length})`}
              </button>
            ))}
          </div>

          {tab === 'subevents' ? (
            <SubEvents project={project} subEvents={subEvents} />
          ) : (
            <>
            <section className="space-y-5">
              <DetailFacts
                facts={[
                  { icon: CalendarDays, label: 'Date', value: formatEventDateRange(event, 'EEE, MMM d, yyyy') },
                  ...(isTba(event) ? [] : [{ icon: Clock, label: 'Time', value: formatEventTimeRange(event) }]),
                  { icon: MapPin, label: 'Location', value: event.location ?? <span className="font-normal text-muted-foreground">Not set</span> },
                ]}
              />
              {editingDetails && <EventDetailsEditor event={event} onDone={() => setEditingDetails(false)} />}
              <EventStatusPicker event={event} />
              <StagePicker event={event} />
            </section>

            <SponsorTracker project={project} />

            <section>
              <SectionHeader title="Overview" />
              <PageBody key={event.id} pageId={event.id} notionUrl={event.notionUrl} noun="Overview" />
            </section>

            <div className="grid gap-10 lg:grid-cols-2">
              <section>
                <EventTodoPanel eventId={event.id} />
              </section>
              <section>
                <EventFinancePanel eventId={event.id} />
              </section>
            </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
