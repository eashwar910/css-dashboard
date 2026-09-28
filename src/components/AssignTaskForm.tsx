import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTaskRequests } from '@/hooks/useTaskRequests';

/**
 * "Add a task for someone": President, Vice President and Head of Tech only
 * (the server checks too). The assignee gets an accept-only request; the task
 * joins their to-do list once they accept.
 */
export function AssignTaskForm() {
  const { canAssign, members, assign } = useTaskRequests();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sending, setSending] = useState(false);

  if (!canAssign) return null;

  const canSend = title.trim() !== '' && assigneeEmail !== '' && !sending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    try {
      const name = await assign({ title: title.trim(), assigneeEmail, dueDate: dueDate || undefined });
      toast({ title: 'Task request sent', description: `${name} will see it next time they open the dashboard.` });
      setTitle('');
      setAssigneeEmail('');
      setDueDate('');
    } catch (err) {
      toast({ title: "Couldn't assign the task", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 border-t border-border pt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add a task for someone</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task…"
          maxLength={2000}
          disabled={sending}
          style={{ borderRadius: 0 }}
          className="h-8 flex-1 text-xs"
          aria-label="Task"
        />
        <Select value={assigneeEmail} onValueChange={setAssigneeEmail} disabled={sending}>
          <SelectTrigger style={{ borderRadius: 0 }} className="h-8 text-xs sm:w-56" aria-label="Assign to">
            <SelectValue placeholder="Assign to…" />
          </SelectTrigger>
          <SelectContent style={{ borderRadius: 0 }} className="max-h-72">
            {members.map((m) => (
              <SelectItem key={m.email} value={m.email} className="text-xs">
                {m.name}
                {m.role && <span className="ml-1.5 text-muted-foreground">· {m.role.trim()}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={sending}
          style={{ borderRadius: 0 }}
          className="h-8 text-xs sm:w-36"
          aria-label="Due date (optional)"
          title="Due date (optional)"
        />
        <Button type="submit" size="sm" variant="outline" style={{ borderRadius: 0 }} className="h-8 text-xs" disabled={!canSend}>
          <Send className="mr-1 h-3 w-3" />
          {sending ? 'Sending…' : 'Assign'}
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        They'll get a request to accept; it joins their to-do list once they do.
      </p>
    </form>
  );
}
