import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ExternalLink,
  CalendarClock,
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
  ChevronRight,
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
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome back
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here's what's happening in the Computer Science Society this week.
        </p>
      </div>

      {/* Quick Access Documents */}
      <section className="animate-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Access</h2>
          <span className="text-sm text-muted-foreground">
            Notion documents
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {documents.map((doc) => {
            const Icon = iconMap[doc.icon] ?? FileText;
            return (
              <button
                key={doc.id}
                onClick={() => console.log('Open Notion Link')}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/15 text-secondary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div>
                  <p className="text-sm font-medium leading-tight">
                    {doc.title}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Event Pinboard */}
        <section className="lg:col-span-2 animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upcoming Events</h2>
            <Badge variant="secondary" className="rounded-full">
              {upcomingEvents.length} events
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {upcomingEvents.map((event) => {
              const start = parseISO(event.start);
              return (
                <Card
                  key={event.id}
                  className="group overflow-hidden border-border transition-all hover:border-primary hover:shadow-lg"
                >
                  <div className="h-1.5 bg-primary" />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base leading-snug">
                          {event.title}
                        </CardTitle>
                        <CardDescription className="mt-1.5 flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {format(start, 'EEE, MMM d')}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        {format(start, 'h:mm a')} –{' '}
                        {format(parseISO(event.end), 'h:mm a')}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => console.log('Open event details')}
                    >
                      Details
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Weekly To-Do */}
        <section className="animate-fade-in">
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Weekly To-Do</CardTitle>
                <Badge variant="secondary" className="rounded-full">
                  {completedCount}/{tasks.length}
                </Badge>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[340px] pr-4">
                <ul className="space-y-1">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted">
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={() => toggleTask(task.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span
                            className={
                              task.done
                                ? 'text-sm text-muted-foreground line-through'
                                : 'text-sm'
                            }
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
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
