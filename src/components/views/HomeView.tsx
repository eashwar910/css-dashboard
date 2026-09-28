import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  ExternalLink,
  MapPin,
  Clock,
  ScrollText,
  FileText,
  FolderKanban,
  Library,
  Wallet,
  LayoutTemplate,
  Code2,
  Users,
  Briefcase,
  Presentation,
  Search,
  X,
  AlertCircle,
  Trash2,
  HardDrive,
  Plus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Event } from '@/lib/types';
import type { View } from '@/components/Navbar';
import { EVENT_FEATURES } from '@/lib/features';
import { TbaTag } from '@/components/TbaTag';
import { AddDocumentDialog } from '@/components/AddDocumentDialog';
import { formatEventDate, formatEventTimeRange, isTba } from '@/lib/eventDates';

import { useEvents } from '@/hooks/useEvents';
import { useDocuments } from '@/hooks/useDocuments';
import { useTeamMembers } from '@/hooks/useTeamMembers';

const iconMap: Record<string, React.ElementType> = {
  ScrollText,
  FileText,
  FolderKanban,
  Library,
  Wallet,
  LayoutTemplate,
  Code2,
  Users,
  Briefcase,
  Presentation,
};

/** Always shown first in Quick Access, above the Notion documents. */
const PINNED_LINKS = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    url: 'https://drive.google.com/drive/folders/1XO-T3__mMU5ibk8MICyYNTNMO3lT0ZfP?usp=sharing',
    icon: HardDrive,
  },
];

export interface HomeViewProps {
  onNavigate?: (view: View) => void;
}

export function HomeView({ onNavigate }: HomeViewProps = {}) {
  const { upcoming: upcomingEvents, tba: tbaEvents, data: allEvents, isLoading: eventsLoading, error: eventsError, removeEvent } = useEvents();
  const { data: documents, byCategory: docsByCategory, isLoading: docsLoading, error: docsError, addDocument } = useDocuments();
  const [addDocOpen, setAddDocOpen] = useState(false);
  const { data: teamMembers } = useTeamMembers();

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Event shown in the detail dialog
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const { toast } = useToast();

  // Dated upcoming events (already sorted), then events with no date
  // yet that aren't done. Most events are TBA, so they're shown here too.
  const sortedUpcomingEvents = useMemo(
    () => [...upcomingEvents, ...tbaEvents.filter((e) => e.status !== 'done')],
    [upcomingEvents, tbaEvents]
  );

  // Search filtering across events, documents, and members
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedEvents = allEvents.filter((e) =>
      e.title.toLowerCase().includes(q)
    );
    const matchedDocs = documents.filter((d) =>
      d.name.toLowerCase().includes(q)
    );
    const matchedMembers = teamMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        (m.department?.toLowerCase().includes(q) ?? false)
    );

    return {
      events: matchedEvents,
      documents: matchedDocs,
      members: matchedMembers,
      total: matchedEvents.length + matchedDocs.length + matchedMembers.length,
    };
  }, [searchQuery, allEvents, documents, teamMembers]);

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
  };

  return (
    <div className="space-y-12 sm:space-y-14">

      {/* ── Search ───────────────────────────────────────────────────── */}
      <header className="border-b border-border pb-6">
        <div className="flex justify-end">
          {/* Search input filtering across events, documents, members */}
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search events, docs, members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ borderRadius: 0 }}
              className="h-9 border-border bg-background pl-8 pr-7 text-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Search Results Panel (conditionally shown) ──────────────── */}
      {searchResults && (
        <section className="border border-border bg-muted/10 p-4 sm:p-5 space-y-4">
          <div className="flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="font-serif text-base font-semibold">
              Search Results for &ldquo;{searchQuery.trim()}&rdquo;
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {searchResults.total} {searchResults.total === 1 ? 'match' : 'matches'}
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
            </div>
          </div>

          {searchResults.total === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No events, documents, or members match &ldquo;{searchQuery.trim()}&rdquo;.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              {/* Events */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Events ({searchResults.events.length})
                </h3>
                {searchResults.events.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">None found</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {searchResults.events.map((e) => (
                      <li key={e.id} className="py-2">
                        <button
                          onClick={() => handleEventClick(e)}
                          className="text-left w-full group"
                        >
                          <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                            {e.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatEventDate(e, 'MMM d')} · {e.location || 'Location TBA'}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Documents */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Documents ({searchResults.documents.length})
                </h3>
                {searchResults.documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">None found</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {searchResults.documents.map((d) => (
                      <li key={d.id} className="py-2">
                        <button
                          onClick={() => window.open(d.url, '_blank', 'noopener,noreferrer')}
                          className="text-left w-full group flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                              {d.name}
                            </p>
                            {d.category && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {d.category}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Members */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Members ({searchResults.members.length})
                </h3>
                {searchResults.members.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">None found</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {searchResults.members.map((m) => (
                      <li key={m.id} className="py-2">
                        <p className="text-xs font-medium text-foreground">
                          {m.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {[m.role, m.department].filter(Boolean).join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Quick Access ────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="font-serif text-lg font-semibold">Quick Access</h2>
          <button
            type="button"
            onClick={() => setAddDocOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add document
          </button>
        </div>

        {/* Pinned links: always visible, even while Notion documents load */}
        <div className="divide-y divide-border border-b border-border">
          {PINNED_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full items-center gap-4 py-3 text-left transition-colors hover:text-primary"
            >
              <link.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
              <span className="flex-1 text-sm">{link.name}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">Pinned</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          ))}
        </div>

        {docsLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <Skeleton className="h-3.5 w-3.5 shrink-0" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="ml-auto hidden h-3 w-20 sm:block" />
              </div>
            ))}
          </div>
        ) : docsError ? (
          <div className="flex items-center gap-2 py-4 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Couldn't load documents — try refreshing.</span>
          </div>
        ) : documents.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground">
            No Notion documents yet. Use "Add document" to upload one.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {documents.map((doc) => {
              const Icon = (doc.icon && iconMap[doc.icon]) ? iconMap[doc.icon] : FileText;
              return (
                <button
                  key={doc.id}
                  onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                  className="group flex w-full items-center gap-4 py-3 text-left transition-colors hover:text-primary"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                  <span className="flex-1 text-sm">{doc.name}</span>
                  {doc.category && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {doc.category}
                    </span>
                  )}
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <AddDocumentDialog
        open={addDocOpen}
        onOpenChange={setAddDocOpen}
        onAdd={addDocument}
        types={Object.keys(docsByCategory).filter((t) => t !== 'Uncategorised')}
      />

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div>

        {/* ── Upcoming Events / Event Pinboard ─────────────────────── */}
        <section>
          <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="font-serif text-lg font-semibold">Upcoming Events</h2>
            <span className="text-xs text-muted-foreground">
              {eventsLoading ? 'Loading...' : `${sortedUpcomingEvents.length} upcoming`}
            </span>
          </div>

          {eventsLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-4 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ))}
            </div>
          ) : eventsError ? (
            <div className="flex items-center gap-2 py-6 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Couldn't load upcoming events — try refreshing.</span>
            </div>
          ) : sortedUpcomingEvents.length === 0 ? (
            <p className="py-6 text-xs text-muted-foreground">
              No upcoming events scheduled yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {sortedUpcomingEvents.map((event, index) => {
                const tba = isTba(event);
                const isSoonest = index === 0 && !tba;

                return (
                  <article
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleEventClick(event);
                      }
                    }}
                    className={cn(
                      'group block cursor-pointer py-4 text-left transition-colors',
                      isSoonest && 'border-l-2 border-primary pl-3.5 -ml-3.5 bg-muted/20 pr-3'
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tba ? (
                          <TbaTag />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {formatEventDate(event, 'EEEE, MMMM d')}
                          </p>
                        )}
                        {isSoonest && (
                          <span className="border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                            Soonest
                          </span>
                        )}
                      </div>
                      {EVENT_FEATURES.editing && (
                        <button
                          type="button"
                          title="Delete event"
                          aria-label={`Delete event ${event.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventToDelete(event);
                          }}
                          className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <h3 className="font-serif text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                      {event.title}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {!tba && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          {formatEventTimeRange(event)}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {event.location || 'Location TBA'}
                      </span>
                      {EVENT_FEATURES.rsvp && event.rsvpCount > 0 && (
                        <span>
                          {event.rsvpCount} RSVPs
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Event Detail Dialog ──────────────────────────────────────── */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent style={{ borderRadius: 0 }} className="border-border">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" style={{ borderRadius: 0 }} className="text-[10px] uppercase tracking-wider capitalize">
                Event
              </Badge>
              {selectedEvent && isTba(selectedEvent) && <TbaTag />}
            </div>
            <DialogTitle className="font-serif text-xl mt-2">
              {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent && formatEventDate(selectedEvent, 'EEEE, MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-4 border-y border-border py-2.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatEventTimeRange(selectedEvent)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {selectedEvent.location || 'Location TBA'}
                </span>
                {EVENT_FEATURES.rsvp && selectedEvent.rsvpCount > 0 && (
                  <span>{selectedEvent.rsvpCount} RSVPs</span>
                )}
              </div>

              {EVENT_FEATURES.description && (
                <p className="leading-relaxed text-muted-foreground">
                  {selectedEvent.description}
                </p>
              )}

              {selectedEvent.notionUrl && (
                <a
                  href={selectedEvent.notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in Notion
                </a>
              )}

              {EVENT_FEATURES.agenda && selectedEvent.agenda && selectedEvent.agenda.length > 0 && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Agenda
                  </p>
                  <div className="divide-y divide-border text-xs">
                    {selectedEvent.agenda.map((item, i) => (
                      <div key={i} className="flex gap-3 py-1.5">
                        <span className="w-16 shrink-0 text-muted-foreground">{item.time}</span>
                        <span className="text-foreground">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              {onNavigate && (
                <Button
                  variant="outline"
                  size="sm"
                  style={{ borderRadius: 0 }}
                  onClick={() => {
                    setSelectedEvent(null);
                    onNavigate('events');
                  }}
                >
                  Open in Events
                </Button>
              )}
              {EVENT_FEATURES.editing && selectedEvent && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  style={{ borderRadius: 0 }}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                  onClick={() => setEventToDelete(selectedEvent)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete Event
                </Button>
              )}
            </div>
            <Button
              size="sm"
              style={{ borderRadius: 0 }}
              onClick={() => setSelectedEvent(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete Event Dialog ──────────────────────────────── */}
      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent style={{ borderRadius: 0 }} className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold">
              Delete Event
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to remove &ldquo;{eventToDelete?.title}&rdquo;? This will remove the event from the calendar and schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              style={{ borderRadius: 0 }}
              onClick={() => setEventToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ borderRadius: 0 }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (eventToDelete) {
                  removeEvent(eventToDelete.id);
                  if (selectedEvent?.id === eventToDelete.id) {
                    setSelectedEvent(null);
                  }
                  toast({
                    title: 'Event deleted',
                    description: `"${eventToDelete.title}" has been removed.`,
                  });
                  setEventToDelete(null);
                }
              }}
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
