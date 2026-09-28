import { useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useApiResource } from '@/hooks/useApiResource';

// ─────────────────────────────────────────────────────────────────────────────
// useExternalRelations
//
// Sponsors and partners from GET /api/external-relations (Notion: Team
// Dashboard > External Relations). save() creates or edits a row in Notion
// and re-fetches the list.
// ─────────────────────────────────────────────────────────────────────────────

export type RelationType = 'sponsor' | 'partner';

export interface ExternalRelation {
  id: string;
  name: string;
  /** null when Type of Relation isn't set in Notion yet. */
  type: RelationType | null;
  /** Partners: what they give the society, e.g. AI credits. */
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

  return { data: relations, sponsors, partners, uncategorised, isLoading, error, save };
}
