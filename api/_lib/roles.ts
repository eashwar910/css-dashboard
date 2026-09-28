// Role checks by job title. A member's title is their Notion ExCo `Position`
// or committee_members.role, compared case-insensitively. "Tech Lead" is the
// Head of Tech's title in Supabase.

import type { CommitteeMember } from './auth.js';
import { loadTeam } from './team.js';

/** May assign tasks to other members (task requests). */
export const ASSIGNER_ROLES = ['president', 'vice president', 'head of tech', 'tech lead'];
/** May schedule meetings from the dashboard. */
export const MEETING_ORGANISER_ROLES = ['president', 'vice president', 'secretary', 'head of tech', 'tech lead'];

function normaliseRole(role: string | null | undefined): string {
  return (role ?? '').trim().toLowerCase();
}

/** The member's ExCo position from Notion, matched by committee email. */
async function notionPositionFor(member: CommitteeMember): Promise<string | null> {
  const emails = new Set([member.email, member.notionEmail].filter(Boolean));
  const row = (await loadTeam()).find((m) => m.email && emails.has(m.email.toLowerCase()));
  return row?.role ?? null;
}

export async function hasAnyRole(member: CommitteeMember, roles: string[]): Promise<boolean> {
  if (roles.includes(normaliseRole(member.role))) return true;
  return roles.includes(normaliseRole(await notionPositionFor(member)));
}
