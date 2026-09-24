import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

/** The signed-in user's row from public.committee_members. */
export interface CommitteeMember {
  full_name: string;
  role: string;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  member: CommitteeMember | null;
  /** True until the initial session check has resolved. */
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
