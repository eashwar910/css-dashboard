// Notion workspace users, looked up by email.

import type { CommitteeMember } from './auth.js';
import { cached, notion } from './notion.js';
import { committeeNotionEmails } from './supabaseAdmin.js';

/** lowercased email → Notion user id, for every person in the workspace. Cached 60s. */
async function userIdsByEmail(): Promise<Map<string, string>> {
  return cached('users:byEmail', async () => {
    const map = new Map<string, string>();
    let cursor: string | undefined;
    do {
      const res = await notion().users.list({ start_cursor: cursor, page_size: 100 });
      for (const user of res.results) {
        if (user.type === 'person' && user.person?.email) map.set(user.person.email.toLowerCase(), user.id);
      }
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);
    return map;
  });
}

/** The Notion user id for an email (case-insensitive), or null if nobody matches. */
export async function getNotionUserIdByEmail(email: string | null | undefined): Promise<string | null> {
  const key = email?.trim().toLowerCase();
  if (!key) return null;
  return (await userIdsByEmail()).get(key) ?? null;
}

/**
 * Notion user id for a committee member's login email: uses their
 * committee_members.notion_email when set, otherwise the login email.
 */
export async function getNotionUserIdForMemberEmail(loginEmail: string | null | undefined): Promise<string | null> {
  const key = loginEmail?.trim().toLowerCase();
  if (!key) return null;
  const notionEmail = (await committeeNotionEmails())?.get(key);
  return (await getNotionUserIdByEmail(notionEmail)) ?? (await getNotionUserIdByEmail(key));
}

/** The signed-in member's Notion user id: notion_email first, then login email. */
export async function notionUserIdFor(member: Pick<CommitteeMember, 'email' | 'notionEmail'>): Promise<string | null> {
  return (await getNotionUserIdByEmail(member.notionEmail)) ?? (await getNotionUserIdByEmail(member.email));
}
