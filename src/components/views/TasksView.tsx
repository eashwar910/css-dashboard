import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Plus, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTasks } from '@/hooks/useTasks';
import type { Task } from '@/lib/types';
import { TaskEditDialog } from '@/components/TaskEditDialog';
import { parseDate } from '@/lib/eventDates';

/** "Due Sep 30", or "No due date". */
function formatDueDate(dueDate: string | undefined) {
  const due = parseDate(dueDate);
  return due ? `Due ${format(due, 'MMM d')}` : 'No due date';
}

export function TasksView() {
  const {
    weekly: tasks,
    weeklyGroups,
    notionLinked,
    toggleTask,
    createTask,
    isLoading: tasksLoading,
    error: tasksError,
  } = useTasks();
  const { toast } = useToast();

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  // Weekly to-do writes (saved to Notion; the server re-checks permissions)
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

  return (
    <div className="space-y-10">
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Weekly To-Do</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Your tasks and your team's shared tasks for this week, saved to Notion.
        </p>
      </header>

      <section>
        <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="font-serif text-lg font-semibold">This week</h2>
          <span className="text-xs text-muted-foreground">
            {tasksLoading ? 'Loading...' : `${completedCount} of ${tasks.length}`}
          </span>
        </div>

        {tasksLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 py-3">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ) : tasksError ? (
          <div className="flex items-center gap-2 py-6 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Couldn't load tasks — try refreshing.</span>
          </div>
        ) : tasks.length === 0 ? (
          <p className="py-6 text-xs text-muted-foreground">
            {notionLinked
              ? 'No tasks for this week. All caught up!'
              : "Your login email doesn't match a Notion account, so your tasks can't be found yet. Ask an admin to set your Notion email."}
          </p>
        ) : (
          <div>
            {weeklyGroups.map((group) => (
            <div key={group.key} className="mb-2">
            <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.name}
            </h3>
            <ul className="divide-y divide-border">
              {group.tasks.map((task) => (
                <li key={task.id} className="group flex items-start gap-1">
                  <label
                    className={cn(
                      'flex flex-1 min-w-0 items-start gap-3 py-3 transition-colors',
                      task.can.toggle ? 'cursor-pointer hover:text-primary' : 'cursor-default'
                    )}
                    title={task.can.toggle ? undefined : 'Only the PIC or an admin can tick this'}
                  >
                    <Checkbox
                      checked={task.completed}
                      disabled={!task.can.toggle}
                      onCheckedChange={() => handleToggleTask(task.id)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          'text-sm leading-snug',
                          task.completed
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground'
                        )}
                      >
                        {task.title}
                      </span>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {task.completed ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                        ) : (
                          <Circle className="h-3 w-3 shrink-0" />
                        )}
                        <span>{formatDueDate(task.dueDate)}</span>
                        {task.sharedWith && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span>{task.sharedWith}</span>
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
                      onClick={() => setEditingTask(task)}
                      className="mt-3 p-1 text-muted-foreground opacity-0 transition-all hover:text-primary group-hover:opacity-100 focus:opacity-100"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            </div>
            ))}
          </div>
        )}

        {/* Add a task for yourself (no event → "General") */}
        {!tasksLoading && !tasksError && (
          <form onSubmit={handleAddTask} className="mt-3 flex gap-2">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a task for yourself…"
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

        <TaskEditDialog task={editingTask} onOpenChange={(open) => !open && setEditingTask(null)} />
      </section>
    </div>
  );
}
