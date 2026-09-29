import { useMemo } from 'react';
import type { AsyncResult, TeamMember } from '@/lib/types';
import { useApiResource } from '@/hooks/useApiResource';
import { compareMembers } from '@/lib/memberOrder';

// ─────────────────────────────────────────────────────────────────────────────
// useTeamMembers
//
// Returns all ExCo members from GET /api/team (in lib/memberOrder's order)
// plus grouping helpers.
// year, email and avatarUrl are optional: members without a year are left
// out of byYear but still appear in `data`.
// ─────────────────────────────────────────────────────────────────────────────

interface TeamResponse {
  members: {
    id: string;
    name: string;
    role: string | null;
    avatarUrl: string | null;
    year: string | null;
    email: string | null;
  }[];
}

export interface TeamMembersResult extends AsyncResult<TeamMember[]> {
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
        year: m.year ?? undefined,
        email: m.email ?? undefined,
        avatarUrl: m.avatarUrl ?? undefined,
      }))
        .sort((a, b) => compareMembers(a.name, b.name)),
    [response]
  );

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
    byYear,
    byId,
  };
}
