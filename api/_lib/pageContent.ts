// Page bodies: an event's Overview, a meeting's notes/minutes and an external
// relation's notes. Any committee member can edit an event's or a relation's;
// organisers (roles.ts) a meeting's.
// The dashboard's rich-text editor loads `editorMarkdown` and saves Markdown
// back with `pages.updateMarkdown` (see src/lib/editorExtensions.ts for what
// round-trips; scripts/check-editor-roundtrip.ts tests it on real pages).

import type { CommitteeMember } from './auth.js';
import { HttpError } from './http.js';
import { cacheInvalidate, cached, notion } from './notion.js';
import { toDisplayMarkdown, toEditorMarkdown } from './notionMarkdown.js';
import { eventPages } from './events.js';
import { relationPages } from './externalRelations.js';
import { meetingPages } from './meetings.js';
import { isOrganiser, ORGANISER_ONLY } from './roles.js';
import { userNamesById } from './users.js';

export interface PageContentDto {
  /** The page body as GitHub-flavoured Markdown for reading ('' when empty). */
  markdown: string;
  /** What the rich-text editor loads (keeps mentions, colours and Notion-only blocks). */
  editorMarkdown: string;
  /** Notion's own Markdown, exactly as stored. The editor sends it back as `base`. */
  source: string;
  /** True when Notion cut the page short; such pages are read and edited in Notion. */
  truncated: boolean;
  /** Whether the signed-in member may edit this page body. */
  canEdit: boolean;
}

type Source = 'events' | 'meetings' | 'externalRelations';

/** Which database a page id is a live row of, using the cached lists. */
async function sourceOf(id: string): Promise<Source | null> {
  const [events, meetings, relations] = await Promise.all([eventPages(), meetingPages(), relationPages()]);
  if (events.some((p) => p.id === id)) return 'events';
  if (meetings.some((p) => p.id === id)) return 'meetings';
  if (relations.some((p) => p.id === id)) return 'externalRelations';
  return null;
}

async function canEditSource(member: CommitteeMember, source: Source): Promise<boolean> {
  return source !== 'meetings' || isOrganiser(member);
}

async function readContent(id: string, source: Source) {
  return cached(`${source}:content:${id}`, async () => {
    const [res, names] = await Promise.all([notion().pages.retrieveMarkdown({ page_id: id }), userNamesById()]);
    return {
      markdown: toDisplayMarkdown(res.markdown, names),
      editorMarkdown: toEditorMarkdown(res.markdown, names),
      source: res.markdown,
      truncated: res.truncated,
    };
  });
}

/**
 * The page body of an event, meeting or external relation. Returns null if
 * the id isn't a live row of one of those databases, so arbitrary Notion pages can't be read through this.
 */
export async function loadPageContent(member: CommitteeMember, id: string): Promise<PageContentDto | null> {
  const source = await sourceOf(id);
  if (!source) return null;
  const [content, canEdit] = await Promise.all([readContent(id, source), canEditSource(member, source)]);
  return { ...content, canEdit: canEdit && !content.truncated };
}

/**
 * Replace a page body with `markdown`. `base` is the `source` the editor
 * started from: if the page changed in Notion since then, this refuses with
 * 409 instead of overwriting someone else's edit. Child pages and databases
 * are never deleted (Notion refuses the edit instead).
 */
export async function savePageContent(
  member: CommitteeMember,
  id: string,
  input: { markdown?: unknown; base?: unknown },
): Promise<PageContentDto> {
  if (typeof input.markdown !== 'string') throw new HttpError(400, '"markdown" must be text');
  if (typeof input.base !== 'string') throw new HttpError(400, '"base" must be the content you started editing from');
  if (input.markdown.length > 200_000) throw new HttpError(400, 'This is too long to save');
  const source = await sourceOf(id);
  if (!source) throw new HttpError(404, 'Page not found');
  if (!(await canEditSource(member, source))) throw new HttpError(403, ORGANISER_ONLY);

  const current = await notion().pages.retrieveMarkdown({ page_id: id });
  if (current.truncated) throw new HttpError(409, 'This page is too long to edit here. Edit it in Notion.');
  if (current.markdown !== input.base) {
    throw new HttpError(409, 'Someone changed this page while you were editing. Copy your changes, then reopen it to get the latest version.');
  }

  await notion().pages.updateMarkdown({
    page_id: id,
    type: 'replace_content',
    replace_content: { new_str: input.markdown, allow_deleting_content: false },
  });
  cacheInvalidate(`${source}:content:${id}`);
  const saved = await loadPageContent(member, id);
  if (!saved) throw new HttpError(404, 'Page not found');
  return saved;
}
