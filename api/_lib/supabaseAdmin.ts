// Service-role Supabase client. SERVER ONLY: it bypasses row-level security.
// Used for lookups across all committee members (e.g. the Team email join),
// which a signed-in member's own token can't do.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cached } from './notion.js';
import { requireEnv } from './env.js';

let admin: SupabaseClient | null = null;

/**
 * The service-role client, or null when SUPABASE_SERVICE_ROLE_KEY isn't set.
 * Callers must degrade gracefully on null (e.g. return email: null).
 */
export function supabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  admin ??= createClient(requireEnv('SUPABASE_URL'), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}

/** Normalise a person's name for matching: trimmed, lowercased, single spaces. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface CommitteeRosterRecord {
  name: string;
  email: string | null;
  role: string | null;
}

/** Active committee members from the full Supabase directory. Cached 60s. */
export async function committeeRosterRecords(): Promise<CommitteeRosterRecord[]> {
  const client = supabaseAdmin();
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to load the committee roster');
  return cached('supabase:committeeRoster', async () => {
    const { data, error } = await client.from('committee_members').select('full_name, email, role, active');
    if (error) throw new Error(`committee_members roster read failed: ${error.message}`);
    return (data ?? [])
      .filter((row) => row.active !== false && typeof row.full_name === 'string' && row.full_name.trim())
      .map((row) => ({
        name: row.full_name.trim(),
        email: typeof row.email === 'string' && row.email.trim() ? row.email.trim().toLowerCase() : null,
        role: typeof row.role === 'string' ? row.role : null,
      }));
  });
}

/**
 * committee_members login email (lowercased) → notion_email, for members
 * whose Notion account uses a different email. Cached 60s. null without the key.
 */
export async function committeeNotionEmails(): Promise<Map<string, string> | null> {
  const client = supabaseAdmin();
  if (!client) return null;
  return cached('supabase:committeeNotionEmails', async () => {
    const { data, error } = await client.from('committee_members').select('*');
    if (error) throw new Error(`committee_members read failed: ${error.message}`);
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      const notionEmail = typeof row.notion_email === 'string' ? row.notion_email.trim().toLowerCase() : '';
      if (typeof row.email === 'string' && notionEmail) map.set(row.email.trim().toLowerCase(), notionEmail);
    }
    return map;
  });
}

/**
 * committee_members.full_name (normalised) → email. Cached 60s.
 * Returns null when the service-role key isn't configured.
 */
export async function committeeEmailsByName(): Promise<Map<string, string> | null> {
  const client = supabaseAdmin();
  if (!client) return null;
  return cached('supabase:committeeEmailsByName', async () => {
    const { data, error } = await client.from('committee_members').select('full_name, email');
    if (error) throw new Error(`committee_members read failed: ${error.message}`);
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      if (typeof row.full_name === 'string' && typeof row.email === 'string' && row.full_name.trim()) {
        map.set(normaliseName(row.full_name), row.email.trim().toLowerCase());
      }
    }
    return map;
  });
}
