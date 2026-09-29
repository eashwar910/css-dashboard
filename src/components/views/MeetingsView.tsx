import { useMemo, useState } from 'react';
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
import { AlertCircle, CalendarDays, CalendarPlus, Check, Clock, Loader2, MapPin, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isListed, useMeetings } from '@/hooks/useMeetings';
import { formatEventDate, formatEventTimeRange, isTba, isUpcoming } from '@/lib/eventDates';
import { buildTimeline, whenFromEvent, type WhenValue } from '@/lib/eventWhen';
import { PageBody } from '@/components/PageBody';
import { RichTextEditor } from '@/components/RichTextEditor';
import { TbaTag } from '@/components/TbaTag';
import { DetailFacts } from '@/components/DetailFacts';
import { EventWhenFields } from '@/components/EventWhenFields';
import { MonthCalendar, ViewModeToggle } from '@/components/MonthCalendar';
import type { Meeting, MeetingAttendee, MeetingRsvp, RosterMember } from '@/lib/types';

const MEETING_CHIP_CLASSES = 'border-sky-500/30 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-400';

/** Not over yet (or date TBA): its page holds notes/agenda rather than minutes. */
function isUpcomingMeeting(meeting: Meeting) {
  return isTba(meeting) || isUpcoming(meeting);
}

/** Date, time, venue and type on one line. */
function MeetingMeta({ meeting }: { meeting: Meeting }) {
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {isTba(meeting) ? <TbaTag /> : <span>{formatEventDate(meeting, 'EEEE, MMMM d, yyyy')}</span>}
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
 * Organisers add, edit and delete meetings and write notes and minutes here.
 */
export function MeetingsView() {
  const { upcoming, past, data: allMeetings, isLoading, error, canManage } = useMeetings();
  const [mode, setMode] = useState<'list' | 'calendar'>('list');
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Follow the store, so edits and deletes show in the open dialog
  const openMeeting = allMeetings.find((m) => m.id === openMeetingId) ?? null;

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
              What's coming up, and the minutes from every meeting so far.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ViewModeToggle mode={mode} onChange={setMode} />
            {canManage && (
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
          onSelect={(m) => setOpenMeetingId(m.id)}
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
                      onClick={() => setOpenMeetingId(m.id)}
                      className="group w-full py-3 text-left transition-colors hover:bg-muted/10 sm:px-3"
                    >
                      <span className="block font-serif text-base font-semibold group-hover:text-primary">{m.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <MeetingMeta meeting={m} />
                        <GoingCount meeting={m} />
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
                    <MeetingDetail key={selected.id} meeting={selected} canManage={canManage} headingLevel="h3" />
                  </article>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── One meeting (from Upcoming or the calendar) ─────────────── */}
      <Dialog open={openMeeting !== null} onOpenChange={(open) => !open && setOpenMeetingId(null)}>
        {openMeeting && (
          <DialogContent style={{ borderRadius: 0 }} className="max-h-[90vh] max-w-2xl overflow-y-auto border-border">
            <DialogHeader className="sr-only">
              <DialogTitle>{openMeeting.title}</DialogTitle>
              <DialogDescription>Meeting details, notes and minutes</DialogDescription>
            </DialogHeader>
            <MeetingDetail
              key={openMeeting.id}
              meeting={openMeeting}
              canManage={canManage}
              headingLevel="h2"
              onDeleted={() => setOpenMeetingId(null)}
            />
          </DialogContent>
        )}
      </Dialog>

      <NewMeetingDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MeetingDetail — header, organiser actions, and the notes/minutes page body
// ─────────────────────────────────────────────────────────────────────────────

function MeetingDetail({
  meeting,
  canManage,
  headingLevel,
  onDeleted,
}: {
  meeting: Meeting;
  canManage: boolean;
  headingLevel: 'h2' | 'h3';
  onDeleted?: () => void;
}) {
  const { deleteMeeting } = useMeetings();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const Heading = headingLevel;
  const upcoming = isUpcomingMeeting(meeting);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMeeting(meeting.id);
      toast({ title: 'Meeting deleted', description: `"${meeting.title}" was moved to Notion's trash.` });
      setConfirmDelete(false);
      onDeleted?.();
    } catch (err) {
      toast({ title: "Couldn't delete the meeting", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-w-0">
      <div className="border-b border-border pb-3">
        {/* In the dialog, keep the actions clear of its close button */}
        <div className={cn('flex flex-wrap items-start justify-between gap-3', onDeleted && 'pr-6')}>
          <Heading className="font-serif text-2xl font-semibold">{meeting.title}</Heading>
          {canManage && !editing && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Pencil className="h-3 w-3" />
                Edit details
              </button>
              <button
                type="button"
                title="Delete meeting"
                aria-label={`Delete meeting ${meeting.title}`}
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="mt-3">
          <DetailFacts
            facts={[
              { icon: CalendarDays, label: 'Date', value: formatEventDate(meeting, 'EEE, MMM d, yyyy') },
              ...(isTba(meeting) ? [] : [{ icon: Clock, label: 'Time', value: formatEventTimeRange(meeting) }]),
              {
                icon: MapPin,
                label: 'Venue',
                value: meeting.location ?? <span className="font-normal text-muted-foreground">Not set</span>,
              },
            ]}
          />
        </div>
        {(meeting.type || meeting.createdBy) && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {meeting.type && (
              <span className="border border-sky-500/30 px-1 text-[10px] uppercase tracking-wider text-sky-700 dark:text-sky-400">
                {meeting.type}
              </span>
            )}
            {meeting.createdBy && <span>Added by {meeting.createdBy}</span>}
          </div>
        )}
      </div>

      <div className="pt-4">
        <MeetingAttendance meeting={meeting} />
      </div>

      {editing && (
        <div className="pt-4">
          <MeetingDetailsEditor meeting={meeting} onDone={() => setEditing(false)} />
        </div>
      )}

      <div className="pt-5">
        <PageBody
          key={meeting.id}
          pageId={meeting.id}
          notionUrl={meeting.notionUrl}
          noun={upcoming ? 'Notes' : 'Minutes'}
          emptyText={upcoming ? 'No notes or agenda yet.' : 'No minutes written yet.'}
        />
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !deleting && setConfirmDelete(open)}>
        <AlertDialogContent style={{ borderRadius: 0 }} className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold">Delete meeting</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              &ldquo;{meeting.title}&rdquo; will be moved to Notion&apos;s trash, along with its notes and minutes. It can be restored from the trash in Notion for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel style={{ borderRadius: 0 }} disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ borderRadius: 0 }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                // Keep the dialog open until Notion confirms
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete meeting'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** "3 going", plus the signed-in member's own reply. */
function GoingCount({ meeting }: { meeting: Meeting }) {
  const { me } = useMeetings();
  const count = meeting.attendees.length;
  const rsvp = myRsvp(meeting, me);
  if (!count && !rsvp) return null;
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-xs',
        rsvp === 'going' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
      )}
    >
      {rsvp === 'going' ? <Check className="h-3 w-3 shrink-0" /> : <Users className="h-3 w-3 shrink-0" />}
      {count} going
      {rsvp === 'going' && ' · including you'}
      {rsvp === 'not-going' && ' · you\'re not going'}
    </span>
  );
}

function myRsvp(meeting: Meeting, me: string | null): MeetingRsvp {
  if (!me) return null;
  if (meeting.attendees.some((a) => a.id === me)) return 'going';
  if (meeting.notGoing.some((a) => a.id === me)) return 'not-going';
  return null;
}

type ChipTone = 'going' | 'not-going' | 'none';

function PersonChip({ name, tone }: { name: string; tone: ChipTone }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <li
      className={cn(
        'flex items-center gap-1.5 border py-0.5 pl-0.5 pr-2 text-xs',
        tone === 'going' && 'border-emerald-500/40 bg-emerald-500/10 text-foreground',
        tone === 'not-going' && 'border-rose-500/40 bg-rose-500/10 text-foreground',
        tone === 'none' && 'border-border text-muted-foreground'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-5 w-5 items-center justify-center text-[9px] font-semibold',
          tone === 'going' && 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
          tone === 'not-going' && 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
          tone === 'none' && 'bg-muted text-muted-foreground'
        )}
      >
        {initials}
      </span>
      {name}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MeetingAttendance — who's going (Notion `Attendees`), who isn't (`Not Going`)
// and who hasn't replied; anyone on the committee sets their own reply while
// the meeting is upcoming
// ─────────────────────────────────────────────────────────────────────────────

function PeopleColumn({
  label,
  labelClassName,
  people,
  tone,
  me,
  empty,
}: {
  label: string;
  labelClassName: string;
  people: { key: string; name: string; id?: string | null }[];
  tone: ChipTone;
  me: string | null;
  empty: string;
}) {
  return (
    <div>
      <p className={cn('mb-1.5 text-[11px] font-medium', labelClassName)}>
        {label} ({people.length})
      </p>
      {people.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {people.map((p) => (
            <PersonChip key={p.key} name={me && p.id === me ? `${p.name} (you)` : p.name} tone={tone} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Alphabetical, with the signed-in member first. */
function meFirst(list: MeetingAttendee[], me: string | null) {
  return [...list]
    .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : byName(a, b)))
    .map((a) => ({ key: a.id, name: a.name, id: a.id }));
}

function fromRoster(list: RosterMember[]) {
  return [...list].sort(byName).map((r) => ({ key: r.notionUserId ?? r.name, name: r.name, id: r.notionUserId }));
}

function MeetingAttendance({ meeting }: { meeting: Meeting }) {
  const { roster, me, setRsvp } = useMeetings();
  const { toast } = useToast();
  const [saving, setSaving] = useState<MeetingRsvp | 'clear' | false>(false);
  const upcoming = isUpcomingMeeting(meeting);
  const mine = myRsvp(meeting, me);

  const going = useMemo(() => meFirst(meeting.attendees, me), [meeting.attendees, me]);
  const notGoing = useMemo(() => meFirst(meeting.notGoing, me), [meeting.notGoing, me]);
  const noReply = useMemo(
    () => fromRoster(roster.filter((r) => !isListed(r, meeting.attendees) && !isListed(r, meeting.notGoing))),
    [roster, meeting.attendees, meeting.notGoing]
  );

  const reply = async (choice: Exclude<MeetingRsvp, null>) => {
    // Pressing your current answer again clears it
    const next: MeetingRsvp = mine === choice ? null : choice;
    setSaving(next ?? 'clear');
    try {
      await setRsvp(meeting.id, next);
      toast({
        title: next === 'going' ? "You're going" : next === 'not-going' ? "You're not going" : 'Reply cleared',
        description: meeting.title,
      });
    } catch (err) {
      toast({ title: "Couldn't save your reply", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const choiceButton = (choice: Exclude<MeetingRsvp, null>) => {
    const active = mine === choice;
    const Icon = choice === 'going' ? Check : X;
    return (
      <button
        type="button"
        onClick={() => void reply(choice)}
        disabled={saving !== false}
        aria-pressed={active}
        title={active ? 'Press again to clear your reply' : undefined}
        className={cn(
          'flex items-center gap-1.5 border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60',
          choice === 'going'
            ? active
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-border text-foreground hover:border-emerald-500 hover:text-emerald-600'
            : active
              ? 'border-rose-500 bg-rose-500 text-white'
              : 'border-border text-foreground hover:border-rose-500 hover:text-rose-600'
        )}
      >
        {saving === choice || (active && saving === 'clear') ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
        {choice === 'going' ? 'Going' : 'Not going'}
      </button>
    );
  };

  return (
    <section aria-label="Attendance" className="border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {upcoming ? "Who's going" : 'Who attended'}
        </h4>
        {upcoming &&
          (me ? (
            <div className="flex items-center gap-2" role="group" aria-label="Your reply">
              <span className="text-[11px] text-muted-foreground">Are you going?</span>
              {choiceButton('going')}
              {choiceButton('not-going')}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">No Notion account is linked to your login, so you can't reply.</span>
          ))}
      </div>

      {upcoming ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <PeopleColumn label="Going" labelClassName="text-emerald-700 dark:text-emerald-400" people={going} tone="going" me={me} empty="Nobody yet." />
          <PeopleColumn label="Not going" labelClassName="text-rose-700 dark:text-rose-400" people={notGoing} tone="not-going" me={me} empty="Nobody yet." />
          <PeopleColumn
            label="No reply"
            labelClassName="text-muted-foreground"
            people={noReply}
            tone="none"
            me={me}
            empty={roster.length ? 'Everyone has replied.' : "The committee list couldn't be loaded."}
          />
        </div>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <PeopleColumn label="Attended" labelClassName="text-emerald-700 dark:text-emerald-400" people={going} tone="going" me={me} empty="Nobody was recorded." />
          <PeopleColumn
            label="Didn't attend"
            labelClassName="text-muted-foreground"
            people={fromRoster(roster.filter((r) => !isListed(r, meeting.attendees)))}
            tone="none"
            me={me}
            empty={roster.length ? 'Everyone on the committee attended.' : "The committee list couldn't be loaded."}
          />
        </div>
      )}
    </section>
  );
}

/** Existing venues, for suggestions (Venue is a Notion select). */
function useVenueOptions() {
  const { data } = useMeetings();
  return useMemo(
    () => [...new Set(data.map((m) => m.location).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b)),
    [data]
  );
}

function VenueAndTypeFields({
  idPrefix,
  venue,
  onVenueChange,
  type,
  onTypeChange,
  disabled,
}: {
  idPrefix: string;
  venue: string;
  onVenueChange: (venue: string) => void;
  type: string;
  onTypeChange: (type: string) => void;
  disabled?: boolean;
}) {
  const { types } = useMeetings();
  const venues = useVenueOptions();
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-venue`} className="text-xs">
          Venue <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${idPrefix}-venue`}
          value={venue}
          onChange={(e) => onVenueChange(e.target.value.replace(/,/g, ''))}
          list={`${idPrefix}-venues`}
          placeholder="e.g. F4B09a, or Online"
          maxLength={100}
          disabled={disabled}
          style={{ borderRadius: 0 }}
        />
        <datalist id={`${idPrefix}-venues`}>
          {venues.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-type`} className="text-xs">
          Type <span className="text-muted-foreground">(optional)</span>
        </Label>
        <select
          id={`${idPrefix}-type`}
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
          disabled={disabled}
          style={{ borderRadius: 0 }}
          className="flex h-9 w-full border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">None</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MeetingDetailsEditor — name, date/time (or TBA), venue and type
// ─────────────────────────────────────────────────────────────────────────────

function MeetingDetailsEditor({ meeting, onDone }: { meeting: Meeting; onDone: () => void }) {
  const { updateMeeting } = useMeetings();
  const { toast } = useToast();
  const [title, setTitle] = useState(meeting.title);
  const [when, setWhen] = useState<WhenValue>(() => whenFromEvent(meeting));
  const [venue, setVenue] = useState(meeting.location ?? '');
  const [type, setType] = useState(meeting.type ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const timeline = buildTimeline(when);
  const canSave = typeof timeline !== 'string' && title.trim() !== '' && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof timeline === 'string' || !canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateMeeting(meeting.id, { title: title.trim(), ...timeline, venue: venue.trim() || null, type: type || null });
      toast({ title: 'Meeting updated', description: 'Saved.' });
      onDone();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const idPrefix = `meeting-${meeting.id}`;
  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-border p-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`} className="text-xs">Title *</Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          disabled={saving}
          style={{ borderRadius: 0 }}
          required
        />
      </div>
      <EventWhenFields value={when} onChange={setWhen} idPrefix={idPrefix} disabled={saving} />
      <VenueAndTypeFields idPrefix={idPrefix} venue={venue} onVenueChange={setVenue} type={type} onTypeChange={setType} disabled={saving} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" style={{ borderRadius: 0 }} disabled={!canSave}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="ghost" style={{ borderRadius: 0 }} disabled={saving} onClick={onDone}>
          Cancel
        </Button>
        {saveError && (
          <span role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Not saved: {saveError}
          </span>
        )}
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NewMeetingDialog — organisers only
// ─────────────────────────────────────────────────────────────────────────────

function NewMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createMeeting } = useMeetings();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setDate('');
    setTime('');
    setVenue('');
    setType('');
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
      await createMeeting({
        title: title.trim(),
        date,
        time,
        venue: venue.trim() || null,
        type: type || null,
        notes: notes.trim() || undefined,
      });
      toast({ title: 'Meeting added', description: 'Open it to write the agenda or minutes.' });
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
            You can write the agenda and minutes on the meeting once it's added.
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
          <VenueAndTypeFields idPrefix="meeting-new" venue={venue} onVenueChange={setVenue} type={type} onTypeChange={setType} />
          <div className="space-y-1.5">
            <p className="text-xs font-medium">
              Notes <span className="font-normal text-muted-foreground">(optional, e.g. the agenda)</span>
            </p>
            {/* Remounted per dialog opening so it starts empty */}
            {open && (
              <RichTextEditor initialMarkdown="" onChange={setNotes} disabled={saving} label="Meeting notes" placeholder="Agenda, links, anything to prepare…" />
            )}
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
