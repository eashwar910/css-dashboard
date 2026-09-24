import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthContext, type CommitteeMember } from '@/contexts/auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<CommitteeMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial session check + keep in sync with sign-in / sign-out / refresh.
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Load the committee_members row whenever the signed-in email changes.
  // Kept outside onAuthStateChange: awaiting Supabase calls inside that
  // callback can deadlock the auth client.
  const email = session?.user.email ?? null;
  useEffect(() => {
    if (!email) {
      setMember(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('committee_members')
      .select('full_name, role')
      .eq('email', email)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Failed to load committee member', error);
        setMember(data ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out failed', error);
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, member, loading, signOut }),
    [session, member, loading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
