import { useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useApiResource } from '@/hooks/useApiResource';

// ─────────────────────────────────────────────────────────────────────────────
// useExternalRelations
//
// Sponsors, partners and speakers from GET /api/external-relations (Notion: Team
// Dashboard > External Relations). save() creates or edits a row in Notion,
// remove() moves one to Notion's trash; both re-fetch the list.
// ─────────────────────────────────────────────────────────────────────────────

export type RelationType = 'sponsor' | 'partner' | 'speaker';

export interface ExternalRelation {
  id: string;
  name: string;
  /** null when Type of Relation isn't set in Notion yet. */
  type: RelationType | null;
  /** Partners: what they give the society, e.g. AI credits. Speakers: talk details. */
  valueProvided: string | null;
  bountyUsdt: number | null;
  opsMyr: number | null;
  sponsorshipFormUrl: string | null;
  proofOfPaymentUrl: string | null;
  /** The Notion page. */
  url: string;
}

export type ExternalRelationInput = Partial<Omit<ExternalRelation, 'id' | 'url' | 'type'>> & {
  name: string;
  type: RelationType;
};

export function useExternalRelations() {
  const { data, isLoading, error, reload } = useApiResource<{ relations: ExternalRelation[] }>('external-relations');
  const relations = useMemo(() => data?.relations ?? [], [data]);

  const sponsors = useMemo(() => relations.filter((r) => r.type === 'sponsor'), [relations]);
  const partners = useMemo(() => relations.filter((r) => r.type === 'partner'), [relations]);
  const speakers = useMemo(() => relations.filter((r) => r.type === 'speaker'), [relations]);
  const uncategorised = useMemo(() => relations.filter((r) => r.type === null), [relations]);

  /** Create when id is omitted, otherwise edit that row. */
  const save = useCallback(
    async (input: ExternalRelationInput, id?: string) => {
      await apiFetch(id ? `external-relations?id=${encodeURIComponent(id)}` : 'external-relations', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      });
      reload();
    },
    [reload]
  );

  /** Move a row to Notion's trash (restorable there for 30 days). */
  const remove = useCallback(
    async (id: string) => {
      await apiFetch(`external-relations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      reload();
    },
    [reload]
  );

  return { data: relations, sponsors, partners, speakers, uncategorised, isLoading, error, save, remove };
}
