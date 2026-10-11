import { useState } from 'react';
import { AlertCircle, ExternalLink, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageBody } from '@/components/PageBody';
import { SectionHeader } from '@/components/SectionHeader';
import { SubEvents } from '@/components/SubEvents';
import { EventFinancePanel, EventTodoPanel } from '@/components/views/EventsView';
import { SponsorTracker, StagePicker } from '@/components/views/FlagshipView';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/hooks/use-toast';
import { compareEvents, isProject } from '@/lib/eventDates';
import type { Event } from '@/lib/types';

const PROJECT = 'Gilbot';

/** Gilbot's status: one tag from Notion's `Project Status` options, or a new one typed here. */
function StatusTagPicker({ event }: { event: Event }) {
  const { saveEvent, projectStatuses } = useEvents();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const setStatus = async (status: string | null) => {
    setSaving(true);
    try {
      await saveEvent(event.id, { projectStatus: status });
      setAdding(false);
      setName('');
    } catch (err) {
      toast({ title: "Couldn't change the status", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const text = name.trim();
    if (text && !saving) void setStatus(text);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
        {event.projectStatus && (
          <button type="button" disabled={saving} onClick={() => setStatus(null)} className="text-[11px] text-muted-foreground transition-colors hover:text-foreground">
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {projectStatuses.map((tag) => {
          const active = event.projectStatus === tag;
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              disabled={saving}
              onClick={() => !active && setStatus(tag)}
              className={cn(
                'border px-2.5 py-1 text-xs transition-colors disabled:opacity-60',
                active ? 'border-primary bg-primary font-semibold text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              )}
            >
              {tag}
            </button>
          );
        })}
        {adding ? (
          <form onSubmit={create} className="flex items-center gap-1">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.replace(/,/g, ''))}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
              placeholder="New status…"
              aria-label="New status"
              maxLength={100}
              disabled={saving}
              style={{ borderRadius: 0 }}
              className="h-7 w-40 text-xs"
            />
            <button type="submit" disabled={saving || !name.trim()} className="border border-border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button type="button" title="Cancel" aria-label="Cancel" onClick={() => setAdding(false)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3 w-3" />
            New status
          </button>
        )}
      </div>
      {!event.projectStatus && <p className="text-xs text-muted-foreground">No status set yet.</p>}
    </div>
  );
}

/** The Gilbot project: status tag, stage, sponsors, overview, to-dos and finance, plus sub-events by stage. */
export function GilbotView() {
  const { data: events, isLoading, error, createEvent } = useEvents();
  const { toast } = useToast();
  const [tab, setTab] = useState<'overview' | 'subevents'>('overview');
  const [creating, setCreating] = useState(false);

  const project = events.find(isProject);
  const subEvents = events.filter((e) => e.project === PROJECT && !isProject(e)).sort(compareEvents);

  const create = async () => {
    setCreating(true);
    try {
      await createEvent({ title: PROJECT, start: null, end: null, location: null, status: 'scheduled' });
    } catch (err) {
      toast({ title: "Couldn't create the project", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6">
        <div className="flex items-start gap-2">
          <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">{PROJECT}</h1>
          {project?.notionUrl && (
            <a href={project.notionUrl} target="_blank" rel="noopener noreferrer" title="Open in Notion" aria-label="Open in Notion" className="mt-2 p-1 text-muted-foreground transition-colors hover:text-primary">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Everything for Gilbot in one place: status, stage, sponsors, overview, to-dos, finance and sub-events.
        </p>
      </header>

      {error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn't load Gilbot — try refreshing.</span>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : !project ? (
        <div className="space-y-3 border border-dashed border-border p-6 text-sm">
          <p className="text-muted-foreground">There's no Gilbot row in Notion's Events yet.</p>
          <button
            type="button"
            onClick={create}
            disabled={creating}
            style={{ borderRadius: 0 }}
            className="flex items-center gap-2 border border-border bg-background px-4 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {creating ? 'Creating…' : 'Create Gilbot'}
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

          {tab === 'overview' ? (
            <div className="space-y-10">
              <section className="space-y-5">
                <StatusTagPicker event={project} />
                <StagePicker event={project} />
              </section>

              <SponsorTracker project={PROJECT} />

              <section>
                <SectionHeader title="Overview" />
                <PageBody key={project.id} pageId={project.id} notionUrl={project.notionUrl} noun="Overview" />
              </section>

              <div className="grid gap-10 lg:grid-cols-2">
                <section>
                  <EventTodoPanel eventId={project.id} />
                </section>
                <section>
                  <EventFinancePanel eventId={project.id} />
                </section>
              </div>
            </div>
          ) : (
            <SubEvents project={PROJECT} subEvents={subEvents} />
          )}
        </>
      )}
    </div>
  );
}
