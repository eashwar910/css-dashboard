// Team Dashboard > Documents > Documents (1) → dashboard documents.
// Each document is a row. The link is `Document URL`, otherwise the Notion
// page itself. The `Document File` URL is never used: it expires after ~1h.

import type { PageObjectResponse } from '@notionhq/client';
import { cached, dataSourceId, queryAll } from './notion.js';
import { select, title, url } from './props.js';

export interface DocumentDto {
  id: string;
  name: string;
  url: string;
  /** Lucide icon name; must exist in HomeView's iconMap. */
  icon: string;
  /** `Document Type`, or null when unset. */
  category: string | null;
}

/** Exact `Document Type` options → icon. Options added later fall through to the keyword rules. */
const ICON_BY_TYPE: Record<string, string> = {
  SA: 'ScrollText',
};

const ICON_BY_KEYWORD: [RegExp, string][] = [
  [/financ|budget|claim|receipt/i, 'Wallet'],
  [/minute|meeting|agenda/i, 'Users'],
  [/slide|deck|present/i, 'Presentation'],
  [/proposal|project|plan/i, 'FolderKanban'],
  [/guide|handbook|resource|template/i, 'Library'],
  [/sponsor|partner|contract/i, 'Briefcase'],
];

export const DEFAULT_DOCUMENT_ICON = 'FileText';

export function iconForDocumentType(type: string | null): string {
  if (!type) return DEFAULT_DOCUMENT_ICON;
  return ICON_BY_TYPE[type] ?? ICON_BY_KEYWORD.find(([re]) => re.test(type))?.[1] ?? DEFAULT_DOCUMENT_ICON;
}

export function toDocument(page: PageObjectResponse): DocumentDto {
  const category = select(page, 'Document Type');
  return {
    id: page.id,
    name: title(page, 'Name') ?? 'Untitled document',
    url: url(page, 'Document URL') ?? page.url,
    icon: iconForDocumentType(category),
    category,
  };
}

export async function loadDocuments(): Promise<DocumentDto[]> {
  const pages = await cached('documents:pages', () =>
    queryAll(dataSourceId('documents'), { sorts: [{ timestamp: 'created_time', direction: 'descending' }] }),
  );
  return pages.map(toDocument);
}
