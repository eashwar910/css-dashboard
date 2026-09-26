// Team (ExCo) → dashboard team members.
// Shirt Size, LinkedIn and Fun fact are deliberately never read.

import type { PageObjectResponse } from '@notionhq/client';
import { cached, dataSourceId, queryAll } from './notion.js';
import { files, richText, title } from './props.js';
import { getMemberDetails } from './memberDetails.js';
import { committeeEmailsByName, normaliseName } from './supabaseAdmin.js';

export interface TeamMemberDto {
  id: string;
  name: string;
  role: string | null;
  /** Notion-hosted picture URL. Expires after about an hour, so never cache it longer than the 60s cache. */
  avatarUrl: string | null;
  department: string | null;
  year: string | null;
  /** From Supabase committee_members, matched on full_name. null when unmatched or the service key is missing. */
  email: string | null;
}

export function toTeamMember(page: PageObjectResponse, emailsByName: Map<string, string> | null): TeamMemberDto {
  const name = title(page, 'Name') ?? 'Unnamed member';
  const details = getMemberDetails(page.id);
  return {
    id: page.id,
    name,
    role: richText(page, 'Position'),
    avatarUrl: files(page, 'Picture')[0]?.url ?? null,
    department: details?.department ?? null,
    year: details?.year ?? null,
    email: emailsByName?.get(normaliseName(name)) ?? null,
  };
}

export async function excoPages(): Promise<PageObjectResponse[]> {
  return cached('exco:pages', () =>
    queryAll(dataSourceId('exco'), { sorts: [{ timestamp: 'created_time', direction: 'ascending' }] }),
  );
}

export async function loadTeam(): Promise<TeamMemberDto[]> {
  const [pages, emails] = await Promise.all([excoPages(), committeeEmailsByName()]);
  return pages.map((page) => toTeamMember(page, emails));
}
