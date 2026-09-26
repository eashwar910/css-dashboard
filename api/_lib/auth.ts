// Supabase session check + committee_members allowlist.
//
// The committee_members lookup runs as the signed-in user (anon key + their
// access token), the same way the frontend's AuthProvider reads it, so it is
// subject to the table's RLS and needs no service-role key.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env.js';
import { sendError } from './http.js';

export interface CommitteeMember {
  /** Login email from the Supabase session, lowercased. */
  email: string;
  role: string | null;
  /** committee_members.notion_email, if that column exists and is set. */
  notionEmail: string | null;
  isAdmin: boolean;
}

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  const match = typeof header === 'string' ? header.match(/^Bearer\s+(\S+)\s*$/i) : null;
  return match ? match[1] : null;
}

/** Escape LIKE wildcards so ilike does an exact, case-insensitive match. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Verify the request's Supabase session and that the user is on the committee.
 * On failure, sends 401 (no or invalid token) or 403 (not in committee_members)
 * and returns null. Supabase outages are thrown and become a 500 in withHandler.
 */
export async function requireCommittee(req: VercelRequest, res: VercelResponse): Promise<CommitteeMember | null> {
  const token = bearerToken(req);
  if (!token) {
    sendError(res, 401, 'Missing bearer token');
    return null;
  }

  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const loginEmail = userData?.user?.email?.trim().toLowerCase();
  if (userError || !loginEmail) {
    sendError(res, 401, 'Invalid or expired session');
    return null;
  }

  // select('*') so this works before and after the notion_email column is added.
  const { data: rows, error } = await supabase
    .from('committee_members')
    .select('*')
    .ilike('email', escapeLike(loginEmail))
    .limit(1);
  if (error) throw new Error(`committee_members lookup failed: ${error.message}`);

  const row = rows?.[0] as Record<string, unknown> | undefined;
  // `active` is a column on committee_members; only an explicit false blocks access.
  if (!row || row.active === false) {
    sendError(res, 403, 'Not a committee member');
    return null;
  }

  const role = typeof row.role === 'string' ? row.role : null;
  const notionEmail =
    typeof row.notion_email === 'string' && row.notion_email.trim() ? row.notion_email.trim().toLowerCase() : null;

  return { email: loginEmail, role, notionEmail, isAdmin: role?.toLowerCase() === 'admin' };
}
