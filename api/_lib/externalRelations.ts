// Team Dashboard > External Relations → sponsors, partners and speakers.
// `Type of Relation` is Sponsor, Partner or Speaker. Sponsors use the money and
// paperwork fields; partners use `Value Provided` (free text, e.g. AI credits),
// and speakers use it for their talk details (topic, organisation, contact).
// Any committee member may add, edit or delete a relation; rows have no owner.

import type { CreatePageParameters, PageObjectResponse } from '@notionhq/client';
import { HttpError } from './http.js';
import { cacheInvalidate, cached, dataSourceId, notion, queryAll, retrievePageIn } from './notion.js';
import { number, richText, select, title, url, write } from './props.js';

export type RelationTypeDto = 'sponsor' | 'partner' | 'speaker';

export interface ExternalRelationDto {
  id: string;
  name: string;
  /** null when `Type of Relation` is unset. */
  type: RelationTypeDto | null;
  valueProvided: string | null;
  bountyUsdt: number | null;
  opsMyr: number | null;
  sponsorshipFormUrl: string | null;
  proofOfPaymentUrl: string | null;
  /** The Notion page. */
  url: string;
}

const TYPE_OPTION: Record<RelationTypeDto, string> = { sponsor: 'Sponsor', partner: 'Partner', speaker: 'Speaker' };
const TYPE_BY_OPTION = new Map(Object.entries(TYPE_OPTION).map(([type, option]) => [option, type as RelationTypeDto]));

export function toExternalRelation(page: PageObjectResponse): ExternalRelationDto {
  const type = select(page, 'Type of Relation');
  return {
    id: page.id,
    name: title(page, 'Name') ?? '',
    type: (type ? TYPE_BY_OPTION.get(type) : undefined) ?? null,
    valueProvided: richText(page, 'Value Provided'),
    bountyUsdt: number(page, 'Bounty Amount (USDT)'),
    opsMyr: number(page, 'Ops Amount (MYR)'),
    sponsorshipFormUrl: url(page, 'Sponsorship Form'),
    proofOfPaymentUrl: url(page, 'Proof of Payment'),
    url: page.url,
  };
}

/** Rows with a name, alphabetical. Blank rows (Notion's default empty row) are skipped. */
export async function loadExternalRelations(): Promise<ExternalRelationDto[]> {
  const pages = await cached('externalRelations:pages', () =>
    queryAll(dataSourceId('externalRelations'), { sorts: [{ property: 'Name', direction: 'ascending' }] }),
  );
  return pages.map(toExternalRelation).filter((r) => r.name.trim() !== '');
}

// ── Writes ───────────────────────────────────────────────────────────────────

export interface ExternalRelationInput {
  name?: unknown;
  type?: unknown;
  valueProvided?: unknown;
  bountyUsdt?: unknown;
  opsMyr?: unknown;
  sponsorshipFormUrl?: unknown;
  proofOfPaymentUrl?: unknown;
}

function parseName(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, 'Name is required');
  if (text.length > 200) throw new HttpError(400, 'Name must be 200 characters or fewer');
  return text;
}

function parseType(value: unknown): RelationTypeDto {
  if (value === 'sponsor' || value === 'partner' || value === 'speaker') return value;
  throw new HttpError(400, "Type must be 'sponsor', 'partner' or 'speaker'");
}

function parseText(value: unknown, label: string): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) throw new HttpError(400, `${label} must be text of 2000 characters or fewer`);
  return value.trim() || null;
}

function parseAmount(value: unknown, label: string): number | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new HttpError(400, `${label} must be a number of 0 or more`);
  return Math.round(value * 100) / 100;
}

function parseLink(value: unknown, label: string): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be a link`);
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new HttpError(400, `${label} must be a full link starting with http:// or https://`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new HttpError(400, `${label} must start with http:// or https://`);
  return parsed.toString();
}

/** Notion properties for the fields present in input. Fields left out are untouched. */
function toProperties(input: ExternalRelationInput, requireAll: boolean): NonNullable<CreatePageParameters['properties']> {
  const props: NonNullable<CreatePageParameters['properties']> = {};
  const has = (key: keyof ExternalRelationInput) => requireAll || key in input;
  if (has('name')) props.Name = write.title(parseName(input.name));
  if (has('type')) props['Type of Relation'] = write.select(TYPE_OPTION[parseType(input.type)]);
  if ('valueProvided' in input) props['Value Provided'] = write.richText(parseText(input.valueProvided, 'Value provided'));
  if ('bountyUsdt' in input) props['Bounty Amount (USDT)'] = write.number(parseAmount(input.bountyUsdt, 'Bounty amount'));
  if ('opsMyr' in input) props['Ops Amount (MYR)'] = write.number(parseAmount(input.opsMyr, 'Ops amount'));
  if ('sponsorshipFormUrl' in input) props['Sponsorship Form'] = { url: parseLink(input.sponsorshipFormUrl, 'Sponsorship form') };
  if ('proofOfPaymentUrl' in input) props['Proof of Payment'] = { url: parseLink(input.proofOfPaymentUrl, 'Proof of payment') };
  return props;
}

export async function createExternalRelation(input: ExternalRelationInput): Promise<ExternalRelationDto> {
  const page = await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('externalRelations') },
    properties: toProperties(input, true),
  });
  cacheInvalidate('externalRelations:');
  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the new relation');
  return toExternalRelation(page);
}

export async function updateExternalRelation(id: string, input: ExternalRelationInput): Promise<ExternalRelationDto> {
  if (!(await retrievePageIn('externalRelations', id))) throw new HttpError(404, 'Relation not found');
  const properties = toProperties(input, false);
  if (Object.keys(properties).length === 0) throw new HttpError(400, 'Nothing to update');
  const page = await notion().pages.update({
    page_id: id,
    properties,
  });
  cacheInvalidate('externalRelations:');
  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the updated relation');
  return toExternalRelation(page);
}

/** Move a relation to Notion's trash (restorable there for 30 days). */
export async function deleteExternalRelation(id: string): Promise<void> {
  if (!(await retrievePageIn('externalRelations', id))) throw new HttpError(404, 'Relation not found');
  await notion().pages.update({ page_id: id, in_trash: true });
  cacheInvalidate('externalRelations:');
}
