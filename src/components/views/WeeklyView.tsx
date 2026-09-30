import { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Plus, AlertCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTasks, type PersonGroup } from '@/hooks/useTasks';
import { useTaskRequests } from '@/hooks/useTaskRequests';
import { compareMembers } from '@/lib/memberOrder';
import type { Task } from '@/lib/types';
import { TaskEditDialog } from '@/components/TaskEditDialog';
import { parseDate } from '@/lib/eventDates';

/** "Due Sep 30", or null when there's no due date. */
function formatDueDate(dueDate: string | undefined) {
  const due = parseDate(dueDate);
  return due ? `Due ${format(due, 'MMM d')}` : null;
}

/** "Sep 28 – Oct 4" for the week starting at this ISO instant. */
function weekRange(startIso: string | null) {
  const start = parseDate(startIso);
  if (!start) return '';
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
}

/** "Before Sep 28" for the week starting at this ISO instant. */
function beforeWeek(startIso: string | null) {
  const start = parseDate(startIso);
  return start ? `Before ${format(start, 'MMM d')}` : '';
}

function TaskRow({ task, onToggle, onEdit }: { task: Task; onToggle: (id: string) => void; onEdit: (task: Task) => void }) {
  const due = formatDueDate(task.dueDate);
  return (
    <li className="group flex items-start gap-1">
      <label
        className={cn(
          'flex min-w-0 flex-1 items-start gap-3 py-2.5 transition-colors',
          task.can.toggle ? 'cursor-pointer hover:text-primary' : 'cursor-default'
        )}
        title={task.can.toggle ? undefined : 'Only the PIC or an admin can tick this'}
        aria-busy={task.saving || undefined}
      >
        {/* While saving, the box itself spins; clicks are ignored until it settles. */}
        <Checkbox
          checked={task.completed}
          disabled={!task.can.toggle}
          onCheckedChange={() => onToggle(task.id)}
          className={cn('mt-0.5 shrink-0', task.saving && 'animate-spin')}
          aria-label={task.completed ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        />
        <div className="min-w-0 flex-1">
          <span className={cn('text-sm leading-snug', task.completed ? 'text-muted-foreground line-through' : 'text-foreground')}>
            {task.title}
          </span>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className={task.saving ? 'text-primary' : task.completed ? 'text-emerald-600 dark:text-emerald-400' : undefined}>
              {task.saving
                ? task.completed ? 'Marking done…' : 'Marking not done…'
                : task.completed ? 'Done' : task.status === 'in-progress' ? 'In progress' : 'Not done'}
            </span>
            {due && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span>{due}</span>
              </>
            )}
            {task.project && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span>{task.project}</span>
              </>
            )}
          </p>
        </div>
      </label>
      {task.can.edit && (
        <button
          type="button"
          title="Edit task"
          aria-label={`Edit task ${task.title}`}
          onClick={() => onEdit(task)}
          className="mt-2.5 p-1 text-muted-foreground opacity-0 transition-all hover:text-primary focus:opacity-100 group-hover:opacity-100"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}

function TaskList({
  tasks,
  empty,
  onToggle,
  onEdit,
}: {
  tasks: Task[];
  empty: string;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
}) {
  if (tasks.length === 0) return <p className="py-2.5 text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} />
      ))}
    </ul>
  );
}

/** One person's this-week and last-week (overdue) to-dos, merged from both groupings. */
interface PersonRow {
  key: string;
  name: string;
  isMe: boolean;
  thisWeek: Task[];
  overdue: Task[];
}

type Person = Pick<PersonGroup, 'key' | 'name' | 'isMe'>;

/** A row per person with to-dos, plus `extra` people (boxes to add to) who have none yet. */
function personRows(thisWeekGroups: PersonGroup[], overdueGroups: PersonGroup[], extra: Person[]): PersonRow[] {
  const rows = new Map<string, PersonRow>();
  const grouped = new Set([...thisWeekGroups, ...overdueGroups].map((g) => g.key));
  const order = [...thisWeekGroups, ...overdueGroups, ...extra.filter((p) => !grouped.has(p.key))].sort((a, b) => compareMembers(a.name, b.name) || a.name.localeCompare(b.name));
  for (const g of order) {
    if (!rows.has(g.key)) rows.set(g.key, { key: g.key, name: g.name, isMe: g.isMe, thisWeek: [], overdue: [] });
  }
  for (const g of thisWeekGroups) rows.get(g.key)!.thisWeek = g.tasks;
  for (const g of overdueGroups) rows.get(g.key)!.overdue = g.tasks;
  return [...rows.values()];
}

const doneCount = (tasks: Task[]) => tasks.filter((t) => t.completed).length;

function ColumnLabel({ title, tasks, className }: { title: string; tasks: Task[]; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between border-b border-border/60 pb-1', className)}>
      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {tasks.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {doneCount(tasks)} of {tasks.length} done
        </span>
      )}
    </div>
  );
}

/**
 * Add a to-do under a person's name. Your own box creates the task directly;
 * anyone else's (President, Vice President and Head of Tech only) sends them
 * a request to accept, and it joins their list once they do.
 */
function AddTaskForm({ name, isMe, assigneeEmail }: { name: string; isMe: boolean; assigneeEmail?: string }) {
  const { createTask } = useTasks();
  const { assign } = useTaskRequests();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = title.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      if (isMe) {
        const { warning } = await createTask({ title: text, ...(dueDate ? { dueDate } : {}) });
        if (warning) toast({ title: 'Task added without a PIC', description: warning });
      } else {
        await assign({ title: text, assigneeEmail: assigneeEmail!, dueDate: dueDate || undefined });
        toast({ title: 'Task request sent', description: `${name} will see it next time they open the dashboard.` });
      }
      setTitle('');
      setDueDate('');
    } catch (err) {
      toast({ title: "Couldn't add task", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-2 sm:flex-row">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isMe ? 'Add a to-do for yourself…' : `Add a to-do for ${name}…`}
        maxLength={2000}
        disabled={saving}
        style={{ borderRadius: 0 }}
        className="h-8 flex-1 text-xs"
        aria-label={isMe ? 'New to-do' : `New to-do for ${name}`}
      />
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        disabled={saving}
        style={{ borderRadius: 0 }}
        className="h-8 text-xs sm:w-36"
        aria-label="Due date (optional)"
        title="Due date (optional)"
      />
      <Button type="submit" size="sm" variant="outline" style={{ borderRadius: 0 }} className="h-8 text-xs" disabled={saving || !title.trim()}>
        {isMe ? <Plus className="mr-1 h-3 w-3" /> : <Send className="mr-1 h-3 w-3" />}
        {saving ? (isMe ? 'Adding…' : 'Sending…') : isMe ? 'Add' : 'Assign'}
      </Button>
    </form>
  );
}

function PersonBoxes({
  rows,
  emailFor,
  canAssign,
  onToggle,
  onEdit,
}: {
  rows: PersonRow[];
  /** Committee email for a person key, needed to assign them a task. */
  emailFor: (key: string) => string | undefined;
  canAssign: boolean;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
}) {
  if (rows.length === 0) return <p className="py-6 text-sm text-muted-foreground">No to-dos this week yet.</p>;
  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <section key={row.key} className="border border-border p-4 sm:p-5">
          <h3 className="mb-3 font-serif text-xl font-semibold">
            {row.name}
            {row.isMe && <span className="ml-2 text-sm font-normal text-primary">(you)</span>}
          </h3>
          {(row.isMe || (canAssign && emailFor(row.key))) && (
            <AddTaskForm name={row.name} isMe={row.isMe} assigneeEmail={emailFor(row.key)} />
          )}
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
            <div>
              <ColumnLabel title="This week" tasks={row.thisWeek} />
              <TaskList tasks={row.thisWeek} empty="Nothing this week." onToggle={onToggle} onEdit={onEdit} />
            </div>
            <div>
              <ColumnLabel title="Last week" tasks={row.overdue} />
              <TaskList tasks={row.overdue} empty="Nothing from last week." onToggle={onToggle} onEdit={onEdit} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function GroupsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 py-2">
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Everyone's weekly to-dos, one box per person: this week beside last week's (overdue). */
export function WeeklyView() {
  const {
    thisWeek,
    overdue,
    thisWeekGroups,
    overdueGroups,
    weekStart,
    notionLinked,
    notionUserId,
    toggleTask,
    isLoading,
    error,
  } = useTasks();
  const { canAssign, members } = useTaskRequests();
  const { member } = useAuth();
  const { toast } = useToast();

  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Empty boxes too, so there's somewhere to add: your own, and everyone's for those who can assign.
  const extraPeople: Person[] = [
    ...(notionUserId ? [{ key: notionUserId, name: member?.full_name ?? 'You', isMe: true }] : []),
    ...(canAssign
      ? members.filter((m) => m.notionUserId).map((m) => ({ key: m.notionUserId!, name: m.name, isMe: false }))
      : []),
  ];
  const emailFor = (key: string) => members.find((m) => m.notionUserId === key)?.email;

  const handleToggleTask = (id: string) => {
    toggleTask(id).catch((err: unknown) =>
      toast({ title: "Couldn't update task", description: (err as Error).message, variant: 'destructive' })
    );
  };

  return (
    <div className="space-y-10">
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Weekly</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Everyone's to-dos by person: due this week or later on the left, last week's (anything earlier still open) on the right. A to-do with no due date counts from the day it was added. Saved to Notion.
          {!isLoading && !notionLinked && (
            <span className="mt-1 block text-destructive">
              Your login email doesn't match a Notion account, so none of these are marked as yours. Ask an admin to set your Notion email.
            </span>
          )}
        </p>
      </header>

      {error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn't load tasks — try refreshing.</span>
        </div>
      ) : (
        <div>
          {/* Column headings, lined up with the two columns inside each person's box */}
          <div className="mb-5 grid gap-2 border-b border-border pb-3 lg:grid-cols-2 lg:gap-10 lg:px-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl font-semibold">
                This week <span className="ml-1 text-sm font-normal text-muted-foreground">{weekRange(weekStart)}</span>
              </h2>
              <span className="text-sm text-muted-foreground">
                {isLoading ? 'Loading...' : `${doneCount(thisWeek)} of ${thisWeek.length} done`}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl font-semibold">
                Last week <span className="ml-1 text-sm font-normal text-muted-foreground">{beforeWeek(weekStart)}</span>
              </h2>
              <span className="text-sm text-muted-foreground">
                {isLoading ? 'Loading...' : `${doneCount(overdue)} of ${overdue.length} done`}
              </span>
            </div>
          </div>

          {isLoading ? (
            <GroupsSkeleton />
          ) : (
            <PersonBoxes
              rows={personRows(thisWeekGroups, overdueGroups, extraPeople)}
              emailFor={emailFor}
              canAssign={canAssign}
              onToggle={handleToggleTask}
              onEdit={setEditingTask}
            />
          )}
        </div>
      )}

      <TaskEditDialog task={editingTask} onOpenChange={(open) => !open && setEditingTask(null)} />
    </div>
  );
}
