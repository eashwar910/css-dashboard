// Read helpers and write builders for Notion page properties.
//
// Readers take a page and an EXACT property name (see NOTION_MAPPING.md,
// "Canonical property names"). A missing property, a property of a different
// type, or an empty value returns null (or [] for lists). Readers never throw.

import type { PageObjectResponse } from '@notionhq/client';

type Page = Pick<PageObjectResponse, 'properties'>;

/** The property value if it exists and has the expected type, else undefined. */
function prop(page: Page | null | undefined, name: string, type: string): Record<string, unknown> | undefined {
  const value = page?.properties?.[name] as Record<string, unknown> | undefined;
  return value && value.type === type ? value : undefined;
}

function joinRichText(items: unknown): string | null {
  if (!Array.isArray(items)) return null;
  const text = items.map((t) => (typeof t?.plain_text === 'string' ? t.plain_text : '')).join('');
  return text.length ? text : null;
}

// ── Readers ──────────────────────────────────────────────────────────────────

export function title(page: Page, name: string): string | null {
  return joinRichText(prop(page, name, 'title')?.title);
}

export function richText(page: Page, name: string): string | null {
  return joinRichText(prop(page, name, 'rich_text')?.rich_text);
}

export function select(page: Page, name: string): string | null {
  const option = prop(page, name, 'select')?.select as { name?: string } | null | undefined;
  return option?.name ?? null;
}

export function status(page: Page, name: string): string | null {
  const option = prop(page, name, 'status')?.status as { name?: string } | null | undefined;
  return option?.name ?? null;
}

export function number(page: Page, name: string): number | null {
  const value = prop(page, name, 'number')?.number;
  return typeof value === 'number' ? value : null;
}

export function url(page: Page, name: string): string | null {
  const value = prop(page, name, 'url')?.url;
  return typeof value === 'string' && value.length ? value : null;
}

export function checkbox(page: Page, name: string): boolean | null {
  const value = prop(page, name, 'checkbox')?.checkbox;
  return typeof value === 'boolean' ? value : null;
}

export interface DateValue {
  /** ISO date ("2026-09-30") or datetime with offset ("2026-09-30T19:00:00.000+08:00"). */
  start: string;
  end: string | null;
}

export function date(page: Page, name: string): DateValue | null {
  const value = prop(page, name, 'date')?.date as { start?: string; end?: string | null } | null | undefined;
  return value?.start ? { start: value.start, end: value.end ?? null } : null;
}

export type PersonKind = 'person' | 'group' | 'bot' | 'unknown';

export interface PersonValue {
  id: string;
  name: string | null;
  /** Only present for kind 'person', and only because the integration can read user emails. */
  email: string | null;
  /**
   * 'group' = a Notion group such as "Everyone". 'unknown' = a partial user
   * object (e.g. a removed member) with only an id.
   */
  kind: PersonKind;
}

export function people(page: Page, name: string): PersonValue[] {
  const list = prop(page, name, 'people')?.people;
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => typeof p?.id === 'string')
    .map((p): PersonValue => {
      const kind: PersonKind =
        p.object === 'group' ? 'group' : p.type === 'person' ? 'person' : p.type === 'bot' ? 'bot' : 'unknown';
      return {
        id: p.id,
        name: typeof p.name === 'string' && p.name.length ? p.name : null,
        email: kind === 'person' && typeof p.person?.email === 'string' ? p.person.email : null,
        kind,
      };
    });
}

/**
 * Related page IDs. The page object includes at most 25 relations. Beyond
 * that, Notion sets has_more and the rest need pages.properties.retrieve;
 * no data source in use comes close.
 */
export function relationIds(page: Page, name: string): string[] {
  const list = prop(page, name, 'relation')?.relation;
  if (!Array.isArray(list)) return [];
  return list.map((r) => r?.id).filter((id): id is string => typeof id === 'string');
}

export interface FileValue {
  name: string;
  url: string;
  /** 'file' = Notion-hosted; its URL expires (see expiryTime). 'external' = a link. */
  type: 'file' | 'external';
  expiryTime: string | null;
}

/** Notion-hosted file URLs expire after about an hour. Never cache them longer than that. */
export function files(page: Page, name: string): FileValue[] {
  const list = prop(page, name, 'files')?.files;
  if (!Array.isArray(list)) return [];
  const out: FileValue[] = [];
  for (const f of list) {
    if (f?.type === 'file' && typeof f.file?.url === 'string') {
      out.push({ name: f.name ?? '', url: f.file.url, type: 'file', expiryTime: f.file.expiry_time ?? null });
    } else if (f?.type === 'external' && typeof f.external?.url === 'string') {
      out.push({ name: f.name ?? '', url: f.external.url, type: 'external', expiryTime: null });
    }
  }
  return out;
}

// ── Write builders ───────────────────────────────────────────────────────────
// Each returns the value for one entry in `properties` on pages.create/update:
//   properties: { Status: write.status('Done'), 'Due Date': write.date('2026-10-01') }

/** Notion limits each rich text object to 2000 characters, so split longer text. */
function textObjects(text: string) {
  const chunks = text.match(/[\s\S]{1,2000}/g) ?? [];
  return chunks.map((content) => ({ type: 'text' as const, text: { content } }));
}

export const write = {
  title: (text: string) => ({ title: textObjects(text) }),
  richText: (text: string | null) => ({ rich_text: text ? textObjects(text) : [] }),
  /** null clears the select. The option name must match exactly, or Notion creates a new option. */
  select: (option: string | null) => ({ select: option ? { name: option } : null }),
  /** Status options can't be created through the API; the name must already exist. */
  status: (option: string) => ({ status: { name: option } }),
  number: (value: number | null) => ({ number: value }),
  /** start/end are ISO dates or datetimes. Pass null to clear. */
  date: (start: string | null, end: string | null = null) => ({ date: start ? { start, end } : null }),
  /** Notion user (or group) IDs. [] clears the property. */
  people: (userIds: string[]) => ({ people: userIds.map((id) => ({ id })) }),
  /** Related page IDs. [] clears the relation. */
  relation: (pageIds: string[]) => ({ relation: pageIds.map((id) => ({ id })) }),
  checkbox: (checked: boolean) => ({ checkbox: checked }),
};
