import { useMemo } from 'react';
import type { AsyncResult, TeamMember } from '@/lib/types';
import { useApiResource } from '@/hooks/useApiResource';

// ─────────────────────────────────────────────────────────────────────────────
// useTeamMembers
//
// Returns all ExCo members from GET /api/team plus grouping helpers.
// department, year, email and avatarUrl are optional: members without them
// are left out of byDepartment / byYear but still appear in `data`.
// ─────────────────────────────────────────────────────────────────────────────

interface TeamResponse {
  members: {
    id: string;
    name: string;
    role: string | null;
    avatarUrl: string | null;
    department: string | null;
    year: string | null;
    email: string | null;
  }[];
}

export interface TeamMembersResult extends AsyncResult<TeamMember[]> {
  /** Members grouped by department (members with no department are omitted). */
  byDepartment: Record<string, TeamMember[]>;
  /** Members grouped by year label (members with no year are omitted). */
  byYear: Record<string, TeamMember[]>;
  /** Quick lookup by member id. */
  byId: Record<string, TeamMember>;
}

function groupBy(members: TeamMember[], key: (m: TeamMember) => string | undefined) {
  return members.reduce<Record<string, TeamMember[]>>((acc, m) => {
    const k = key(m);
    if (!k) return acc;
    (acc[k] ??= []).push(m);
    return acc;
  }, {});
}

export function useTeamMembers(): TeamMembersResult {
  const { data: response, isLoading, error } = useApiResource<TeamResponse>('team');

  const data = useMemo<TeamMember[]>(
    () =>
      (response?.members ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role ?? '',
        department: m.department ?? undefined,
        year: m.year ?? undefined,
        email: m.email ?? undefined,
        avatarUrl: m.avatarUrl ?? undefined,
      })),
    [response]
  );

  const byDepartment = useMemo(() => groupBy(data, (m) => m.department), [data]);
  const byYear = useMemo(() => groupBy(data, (m) => m.year), [data]);
  const byId = useMemo(
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
