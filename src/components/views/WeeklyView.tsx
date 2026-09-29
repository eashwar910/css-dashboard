import { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTasks, type PersonGroup } from '@/hooks/useTasks';
import type { Task } from '@/lib/types';
import { TaskEditDialog } from '@/components/TaskEditDialog';
import { AssignTaskForm } from '@/components/AssignTaskForm';
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

function TaskRow({ task, onToggle, onEdit }: { task: Task; onToggle: (id: string) => void; onEdit: (task: Task) => void }) {
  const due = formatDueDate(task.dueDate);
  const canToggle = task.can.toggle && !task.saving;
  return (
    <li className="group flex items-start gap-1">
      <label
        className={cn(
          'flex min-w-0 flex-1 items-start gap-3 py-2.5 transition-colors',
          canToggle ? 'cursor-pointer hover:text-primary' : task.saving ? 'cursor-wait' : 'cursor-default'
        )}
        title={task.can.toggle ? undefined : 'Only the PIC or an admin can tick this'}
        aria-busy={task.saving || undefined}
      >
        {task.saving ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-label="Saving" />
        ) : (
          <Checkbox
            checked={task.completed}
            disabled={!canToggle}
            onCheckedChange={() => onToggle(task.id)}
            className="mt-0.5 shrink-0"
            aria-label={task.completed ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          />
        )}
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
            {task.carriedOver && (
              <span className="border border-amber-500/40 px-1 text-[10px] uppercase tracking-wider text-amber-600">
                From an earlier week
              </span>
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

function PersonGroups({
  groups,
  empty,
  onToggle,
  onEdit,
}: {
  groups: PersonGroup[];
  empty: string;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
}) {
  if (groups.length === 0) return <p className="py-6 text-xs text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const done = group.tasks.filter((t) => t.completed).length;
        return (
          <div key={group.key}>
            <div className="flex items-baseline justify-between border-b border-border/60 pb-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.name}
                {group.isMe && <span className="ml-1.5 normal-case tracking-normal text-primary">(you)</span>}
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {done} of {group.tasks.length} done
              </span>
            </div>
            <ul className="divide-y divide-border">
              {group.tasks.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} />
              ))}
            </ul>
          </div>
        );
      })}
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

/** Everyone's weekly to-dos, grouped by person: this week and last week. */
export function WeeklyView() {
  const {
    thisWeek,
    lastWeek,
    thisWeekGroups,
    lastWeekGroups,
    weekStart,
    lastWeekStart,
    notionLinked,
    toggleTask,
    createTask,
    isLoading,
    error,
  } = useTasks();
  const { toast } = useToast();

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const handleToggleTask = (id: string) => {
    toggleTask(id).catch((err: unknown) =>
      toast({ title: "Couldn't update task", description: (err as Error).message, variant: 'destructive' })
    );
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || addingTask) return;
    setAddingTask(true);
    try {
      const { warning } = await createTask({ title });
      setNewTaskTitle('');
      if (warning) toast({ title: 'Task added without a PIC', description: warning });
    } catch (err) {
      toast({ title: "Couldn't add task", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setAddingTask(false);
    }
  };

  const doneCount = (tasks: Task[]) => tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-10">
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Weekly</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Everyone's to-dos for this week and last week, by person, saved to Notion.
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
        <div className="grid gap-12 lg:grid-cols-2">
          {/* ── This week ─────────────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-lg font-semibold">
                This week <span className="ml-1 text-xs font-normal text-muted-foreground">{weekRange(weekStart)}</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                {isLoading ? 'Loading...' : `${doneCount(thisWeek)} of ${thisWeek.length} done`}
              </span>
            </div>

            {isLoading ? (
              <GroupsSkeleton />
            ) : (
              <PersonGroups groups={thisWeekGroups} empty="No to-dos this week yet." onToggle={handleToggleTask} onEdit={setEditingTask} />
            )}

            {/* Add a task for yourself (this week, no event) */}
            {!isLoading && (
              <form onSubmit={handleAddTask} className="mt-5 flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a to-do for yourself this week…"
                  disabled={addingTask}
                  style={{ borderRadius: 0 }}
                  className="h-8 text-xs"
                />
                <Button type="submit" size="sm" variant="outline" style={{ borderRadius: 0 }} className="h-8 text-xs" disabled={addingTask || !newTaskTitle.trim()}>
                  <Plus className="mr-1 h-3 w-3" />
                  {addingTask ? 'Adding…' : 'Add'}
                </Button>
              </form>
            )}

            <AssignTaskForm />
          </section>

          {/* ── Last week ─────────────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-lg font-semibold">
                Last week <span className="ml-1 text-xs font-normal text-muted-foreground">{weekRange(lastWeekStart)}</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                {isLoading ? 'Loading...' : `${doneCount(lastWeek)} of ${lastWeek.length} done`}
              </span>
            </div>
            {isLoading ? (
              <GroupsSkeleton />
            ) : (
              <PersonGroups groups={lastWeekGroups} empty="No to-dos were planned for last week." onToggle={handleToggleTask} onEdit={setEditingTask} />
            )}
          </section>
        </div>
      )}

      <TaskEditDialog task={editingTask} onOpenChange={(open) => !open && setEditingTask(null)} />
    </div>
  );
}
