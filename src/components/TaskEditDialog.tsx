import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTasks } from '@/hooks/useTasks';
import { useEvents } from '@/hooks/useEvents';
import type { Task, TaskStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const NO_EVENT = 'none';

/**
 * Edit a task's title, due date, status and event link, or delete it.
 * Delete is only offered when task.can.delete; the server re-checks both.
 */
export function TaskEditDialog({ task, onOpenChange }: { task: Task | null; onOpenChange: (open: boolean) => void }) {
  const { editTask, deleteTask } = useTasks();
  const { data: allEvents } = useEvents();
  const { toast } = useToast();
  const events = allEvents.filter((e) => e.kind === 'event');

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [eventId, setEventId] = useState<string>(NO_EVENT);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDueDate(task.dueDate?.slice(0, 10) ?? '');
    setStatus(task.status);
    setEventId(task.eventIds[0] ?? NO_EVENT);
    setConfirmDelete(false);
  }, [task]);

  if (!task) return null;

  const close = () => onOpenChange(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await editTask(task.id, {
        title: title.trim(),
        dueDate: dueDate || null,
        status,
        eventId: eventId === NO_EVENT ? null : eventId,
      });
      toast({ title: 'Task saved' });
      close();
    } catch (err) {
      toast({ title: "Couldn't save task", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    close();
    try {
      await deleteTask(task.id);
      toast({ title: 'Task deleted', description: 'Moved to Notion trash.' });
    } catch (err) {
      toast({ title: "Couldn't delete task", description: (err as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent style={{ borderRadius: 0 }} className="max-w-md border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-semibold">Edit task</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Changes are saved to Notion.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-xs">Title *</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ borderRadius: 0 }} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-due" className="text-xs">Due date</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ borderRadius: 0 }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-status" className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger id="task-status" style={{ borderRadius: 0 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ borderRadius: 0 }}>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-event" className="text-xs">Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger id="task-event" style={{ borderRadius: 0 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ borderRadius: 0 }}>
                <SelectItem value={NO_EVENT}>No event (General)</SelectItem>
                {events.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex flex-col gap-2 pt-3 sm:flex-row sm:justify-between">
            {task.can.delete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                style={{ borderRadius: 0 }}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {confirmDelete ? 'Click again to delete' : 'Delete'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" style={{ borderRadius: 0 }} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" size="sm" style={{ borderRadius: 0 }} disabled={saving || !title.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
