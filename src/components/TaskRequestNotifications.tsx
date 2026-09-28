import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTaskRequests } from '@/hooks/useTaskRequests';
import { parseDate } from '@/lib/eventDates';

const POLL_MS = 2 * 60_000;

/**
 * Tasks assigned to me by the President, Vice President or Head of Tech.
 * Shown bottom-right on every page until accepted: there is no reject or
 * dismiss, by design. Accepting adds the task to my to-do list.
 */
export function TaskRequestNotifications() {
  const { requests, accept, reload } = useTaskRequests();
  const { toast } = useToast();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Pick up requests assigned while the dashboard is already open
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  if (requests.length === 0) return null;
  const request = requests[0];
  const due = parseDate(request.dueDate);

  const handleAccept = async () => {
    setAcceptingId(request.id);
    try {
      await accept(request.id);
      toast({ title: 'Task accepted', description: `"${request.title}" is on your Weekly To-Do.` });
    } catch (err) {
      toast({ title: "Couldn't accept the task", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <section
      aria-live="polite"
      aria-label="Task requests"
      className="fixed right-4 top-[4.5rem] z-40 w-[calc(100%-2rem)] max-w-sm border border-border bg-background p-4 shadow-lg sm:right-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Inbox className="h-3.5 w-3.5" />
          Task request
        </p>
        {requests.length > 1 && <span className="text-[11px] text-muted-foreground">1 of {requests.length}</span>}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{request.requestedBy ?? 'A committee lead'}</span> assigned you a task
      </p>
      <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">{request.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{due ? `Due ${format(due, 'EEE, MMM d')}` : 'No due date'}</p>

      <Button
        size="sm"
        onClick={() => void handleAccept()}
        disabled={acceptingId !== null}
        style={{ borderRadius: 0 }}
        className="mt-3 w-full"
      >
        <Check className="mr-1.5 h-3.5 w-3.5" />
        {acceptingId ? 'Accepting…' : 'Accept'}
      </Button>
    </section>
  );
}
