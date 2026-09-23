import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ExternalLink,
  MapPin,
  CheckCircle2,
  Circle,
  Clock,
  ScrollText,
  FileText,
  FolderKanban,
  Library,
  Wallet,
  LayoutTemplate,
} from 'lucide-react';
import {
  documents,
  upcomingEvents,
  weeklyTasks,
  type Task,
} from '@/data/mockData';

const iconMap: Record<string, typeof ScrollText> = {
  ScrollText,
  FileText,
  FolderKanban,
  Library,
  Wallet,
  LayoutTemplate,
};

export function HomeView() {
  const [tasks, setTasks] = useState<Task[]>(weeklyTasks);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const completedCount = tasks.filter((t) => t.done).length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="space-y-14">

      {/* ── Page header ────────────────────────────────────────────── */}
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          Welcome back
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Here's what's happening in the Computer Science Society this week.
        </p>
      </header>

      {/* ── Quick Access ────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="font-serif text-lg font-semibold">Quick Access</h2>
          <span className="text-xs text-muted-foreground">Notion documents</span>
        </div>

        {/* Document table — no cards, just ruled rows */}
        <div className="divide-y divide-border">
          {documents.map((doc) => {
            const Icon = iconMap[doc.icon] ?? FileText;
            return (
              <button
                key={doc.id}
                onClick={() => console.log('Open Notion Link')}
                className="group flex w-full items-center gap-4 py-3 text-left transition-colors hover:text-primary"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                <span className="flex-1 text-sm">{doc.title}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div className="grid gap-12 lg:grid-cols-5">

        {/* ── Upcoming Events (3 cols) ─────────────────────────────── */}
        <section className="lg:col-span-3">
          <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="font-serif text-lg font-semibold">Upcoming Events</h2>
            <span className="text-xs text-muted-foreground">
              {upcomingEvents.length} scheduled
            </span>
          </div>

          {/* Events as a typeset table — no boxes */}
          <div className="divide-y divide-border">
            {upcomingEvents.map((event) => {
              const start = parseISO(event.start);
              return (
                <article key={event.id} className="py-4">
                  {/* Date line — small, muted */}
                  <p className="mb-1 text-xs text-muted-foreground">
                    {format(start, 'EEEE, MMMM d')}
                  </p>
                  {/* Title as editorial entry */}
                  <h3 className="font-serif text-base font-semibold leading-snug text-foreground">
                    {event.title}
                  </h3>
                  {/* Meta row */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {format(start, 'h:mm a')}
                      {' – '}
                      {format(parseISO(event.end), 'h:mm a')}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Weekly To-Do (2 cols) ──────────────────────────────────── */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="font-serif text-lg font-semibold">Weekly To-Do</h2>
            {/* Progress as plain fraction, not a badge */}
            <span className="text-xs text-muted-foreground">
              {completedCount} of {tasks.length}
            </span>
          </div>

          {/* Hairline progress bar — 1px height, no rounding */}
          <div className="mb-4 h-px w-full bg-border">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <ScrollArea className="h-[360px] scrollbar-thin">
            <ul className="divide-y divide-border">
              {tasks.map((task) => (
                <li key={task.id}>
                  <label className="flex cursor-pointer items-start gap-3 py-3 transition-colors hover:text-primary">
                    <Checkbox
                      checked={task.done}
                      onCheckedChange={() => toggleTask(task.id)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          'text-sm leading-snug',
                          task.done ? 'text-muted-foreground line-through' : 'text-foreground'
                        )}
                      >
                        {task.title}
                      </span>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        {task.done ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                        Due {format(parseISO(task.dueDate), 'MMM d')}
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </section>

      </div>
    </div>
  );
}
