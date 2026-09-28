import { useMemo } from 'react';
import { useApiResource } from '@/hooks/useApiResource';

// ─────────────────────────────────────────────────────────────────────────────
// useSponsors
//
// Sponsor contacts from GET /api/sponsors (Notion: Marketing Team > Contacts,
// Category = Sponsor), plus the same list grouped by company.
// ─────────────────────────────────────────────────────────────────────────────

export interface SponsorContact {
  id: string;
  name: string;
  jobTitle: string | null;
  companies: string[];
  tags: string[];
  contactMethod: string | null;
  linkedIn: string | null;
}

export interface SponsorCompany {
  name: string;
  contacts: SponsorContact[];
}

const NO_COMPANY = 'Company not set';

export function useSponsors() {
  const { data, isLoading, error } = useApiResource<{ sponsors: SponsorContact[] }>('sponsors');
  const sponsors = useMemo(() => data?.sponsors ?? [], [data]);

  const byCompany = useMemo<SponsorCompany[]>(() => {
    const groups = new Map<string, SponsorContact[]>();
    for (const contact of sponsors) {
      for (const company of contact.companies.length ? contact.companies : [NO_COMPANY]) {
        const list = groups.get(company) ?? [];
        list.push(contact);
        groups.set(company, list);
      }
    }
    return [...groups.entries()]
      .map(([name, contacts]) => ({ name, contacts }))
      .sort((a, b) => (a.name === NO_COMPANY ? 1 : b.name === NO_COMPANY ? -1 : a.name.localeCompare(b.name)));
  }, [sponsors]);

  return { data: sponsors, byCompany, isLoading, error };
}
