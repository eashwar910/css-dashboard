// Shared Notion client, data source IDs, paginated queries and a small cache.

import { Client, isFullPage, isNotionClientError } from '@notionhq/client';
import type { PageObjectResponse, QueryDataSourceParameters } from '@notionhq/client';
import { requireEnv } from './env.js';

export const NOTION_VERSION = '2026-03-11';

/** Env var holding each data source ID in use. IDs are listed in NOTION_MAPPING.md. */
const DATA_SOURCE_ENV = {
  tasks: 'NOTION_TASKS_DS_ID',
  events: 'NOTION_EVENTS_DS_ID',
  meetings: 'NOTION_MEETINGS_DS_ID',
  exco: 'NOTION_EXCO_DS_ID',
  documents: 'NOTION_DOCUMENTS_DS_ID',
  transactions: 'NOTION_TRANSACTIONS_DS_ID',
} as const;

export type DataSourceName = keyof typeof DATA_SOURCE_ENV;

/** Data source ID for a named source. Throws ConfigError if its env var is missing. */
export function dataSourceId(name: DataSourceName): string {
  return requireEnv(DATA_SOURCE_ENV[name]);
}

let client: Client | null = null;

/**
 * The shared Notion client. Created lazily so a missing NOTION_TOKEN surfaces
 * as a handled ConfigError inside a request instead of crashing at import.
 */
export function notion(): Client {
  client ??= new Client({ auth: requireEnv('NOTION_TOKEN'), notionVersion: NOTION_VERSION });
  return client;
}

type QueryParams = Omit<QueryDataSourceParameters, 'data_source_id' | 'start_cursor'>;

/** Query every page of a data source, following next_cursor. Returns full page objects only. */
export async function queryAll(dataSourceId: string, params: QueryParams = {}): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().dataSources.query({
      ...params,
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: params.page_size ?? 100,
    });
    for (const result of res.results) if (isFullPage(result)) pages.push(result);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return pages;
}

/**
 * Read a page fresh from Notion (never cached) and return it only if it's a
 * live row of the given data source. Returns null for anything else: a page
 * in another data source, a trashed page, or one the integration can't see.
 */
export async function retrievePageIn(name: DataSourceName, pageId: string): Promise<PageObjectResponse | null> {
  let page;
  try {
    page = await notion().pages.retrieve({ page_id: pageId });
  } catch (err) {
    if (isNotionClientError(err) && (err.code === 'object_not_found' || err.code === 'validation_error')) return null;
    throw err;
  }
  if (!isFullPage(page) || page.in_trash) return null;
  const parent = page.parent;
  const strip = (id: string) => id.replace(/-/g, '');
  if (parent.type !== 'data_source_id' || strip(parent.data_source_id) !== strip(dataSourceId(name))) return null;
  return page;
}

// ── 60s in-memory cache ──────────────────────────────────────────────────────
// Per function instance only. Keys are namespaced by data source name, e.g.
// "tasks:all", so a write can clear everything for that source with
// cacheInvalidate("tasks:").

const TTL_MS = 60_000;
const cache = new Map<string, { value: unknown; expires: number }>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = TTL_MS): T {
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

/** Remove every entry whose key starts with prefix. An empty prefix clears the whole cache. */
export function cacheInvalidate(prefix: string): void {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

/** Return the cached value for key, or load, cache and return it. */
export async function cached<T>(key: string, load: () => Promise<T>, ttlMs = TTL_MS): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  return cacheSet(key, await load(), ttlMs);
}
