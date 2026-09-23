import { useState, useEffect, useMemo } from 'react';
import type { AsyncResult, Task, TaskStatus } from '@/lib/types';
import { mockTasks } from '@/data';

// ─────────────────────────────────────────────────────────────────────────────
// useTasks
//
// Returns all tasks, plus derived aggregates (by project, by status).
// Simulates an artificial latency (350ms) to exercise loading/skeleton states.
//
// FUTURE: Replace the setTimeout block below with a real fetch or SWR call
// against a Notion database endpoint.
// ─────────────────────────────────────────────────────────────────────────────

export interface TasksResult extends AsyncResult<Task[]> {
  /** Tasks grouped by their `project` field. */
  byProject: Record<string, Task[]>;
  /** Tasks grouped by their `status` field. */
  byStatus: Record<TaskStatus, Task[]>;
  /** Count of completed tasks. */
  completedCount: number;
  /** Total task count. */
  totalCount: number;
}

export function useTasks(): TasksResult {
  const [data, setData] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(mockTasks);
      setIsLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  const byProject = useMemo<Record<string, Task[]>>(() => {
    return data.reduce<Record<string, Task[]>>((acc, task) => {
      if (!acc[task.project]) acc[task.project] = [];
      acc[task.project].push(task);
      return acc;
    }, {});
  }, [data]);

  const byStatus = useMemo<Record<TaskStatus, Task[]>>(() => {
    const base: Record<TaskStatus, Task[]> = { todo: [], 'in-progress': [], done: [] };
    return data.reduce((acc, task) => {
      acc[task.status].push(task);
      return acc;
    }, base);
  }, [data]);

  const completedCount = useMemo(
    () => data.filter((t) => t.completed).length,
    [data]
  );

  return {
    data,
    isLoading,
    error,
    byProject,
    byStatus,
    completedCount,
    totalCount: data.length,
  };
}
