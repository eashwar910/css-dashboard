import { useState, useEffect, useMemo } from 'react';
import type { AsyncResult, TeamMember } from '@/lib/types';
import { mockTeamMembers } from '@/data';

// ─────────────────────────────────────────────────────────────────────────────
// useTeamMembers
//
// Returns all team members plus grouping helpers.
// Simulates an artificial latency (400ms) to exercise loading/empty/error states.
//
// FUTURE: Replace the setTimeout block with a Notion database query:
//   const { data, isLoading, error } = useSWR<TeamMember[]>('/api/team', fetcher);
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamMembersResult extends AsyncResult<TeamMember[]> {
  /** Members grouped by department. */
  byDepartment: Record<string, TeamMember[]>;
  /** Members grouped by year label. */
  byYear: Record<string, TeamMember[]>;
  /** Quick lookup by member id. */
  byId: Record<string, TeamMember>;
}

export function useTeamMembers(): TeamMembersResult {
  const [data, setData] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(mockTeamMembers);
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const byDepartment = useMemo<Record<string, TeamMember[]>>(
    () =>
      data.reduce<Record<string, TeamMember[]>>((acc, m) => {
        if (!acc[m.department]) acc[m.department] = [];
        acc[m.department].push(m);
        return acc;
      }, {}),
    [data]
  );

  const byYear = useMemo<Record<string, TeamMember[]>>(
    () =>
      data.reduce<Record<string, TeamMember[]>>((acc, m) => {
        if (!acc[m.year]) acc[m.year] = [];
        acc[m.year].push(m);
        return acc;
      }, {}),
    [data]
  );

  const byId = useMemo<Record<string, TeamMember>>(
    () =>
      data.reduce<Record<string, TeamMember>>((acc, m) => {
        acc[m.id] = m;
        return acc;
      }, {}),
    [data]
  );

  return {
    data,
    isLoading,
    error,
    byDepartment,
    byYear,
    byId,
  };
}
