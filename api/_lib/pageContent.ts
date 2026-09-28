// Page bodies: an event's Overview and a meeting's minutes. Reads work for
// both; only event Overviews can be edited from the dashboard.

import { HttpError } from './http.js';
import { cacheInvalidate, cached, notion } from './notion.js';
import { toDisplayMarkdown } from './notionMarkdown.js';
import { eventPages } from './events.js';
import { meetingPages } from './meetings.js';
import { userNamesById } from './users.js';

export interface PageContentDto {
  /** The page body as GitHub-flavoured Markdown ('' when the page is empty). */
  markdown: string;
  /**
   * Notion's own Markdown, exactly as stored. Events only: it's what the
   * Overview editor edits and sends back as `base`.
   */
  source?: string;
  /** True when Notion cut the page short; the dashboard links to Notion for the rest. */
  truncated: boolean;
}

/** Which database a page id is a live row of, using the cached lists. */
async function sourceOf(id: string): Promise<'events' | 'meetings' | null> {
  const [events, meetings] = await Promise.all([eventPages(), meetingPages()]);
  if (events.some((p) => p.id === id)) return 'events';
  if (meetings.some((p) => p.id === id)) return 'meetings';
  return null;
}

/**
 * The page body of an event or meeting. Returns null if the id isn't a live
 * row of either database, so arbitrary Notion pages can't be read through this.
 */
export async function loadPageContent(id: string): Promise<PageContentDto | null> {
  const source = await sourceOf(id);
  if (!source) return null;
  return cached(`${source}:content:${id}`, async () => {
    const [res, names] = await Promise.all([notion().pages.retrieveMarkdown({ page_id: id }), userNamesById()]);
    return {
      markdown: toDisplayMarkdown(res.markdown, names),
      ...(source === 'events' ? { source: res.markdown } : {}),
      truncated: res.truncated,
    };
  });
}

/**
 * Replace an event's Overview (its page body) with `markdown`. `base` is the
 * `source` the editor started from: if the page changed in Notion since then,
 * this refuses with 409 instead of overwriting someone else's edit.
 * Child pages and databases on the page are never deleted (Notion refuses
 * the edit instead).
 */
export async function saveEventOverview(id: string, input: { markdown?: unknown; base?: unknown }): Promise<PageContentDto> {
  if (typeof input.markdown !== 'string') throw new HttpError(400, '"markdown" must be text');
  if (typeof input.base !== 'string') throw new HttpError(400, '"base" must be the Overview you started editing from');
  if (input.markdown.length > 100_000) throw new HttpError(400, 'Overview is too long');
  if ((await sourceOf(id)) !== 'events') throw new HttpError(404, 'Event not found');

  const current = await notion().pages.retrieveMarkdown({ page_id: id });
  if (current.truncated) throw new HttpError(409, 'This page is too long to edit here. Edit it in Notion.');
  if (current.markdown !== input.base) {
    throw new HttpError(409, 'Someone changed this Overview in Notion while you were editing. Reopen the event to get the latest version.');
  }

  await notion().pages.updateMarkdown({
    page_id: id,
    type: 'replace_content',
    replace_content: { new_str: input.markdown, allow_deleting_content: false },
  });
  cacheInvalidate(`events:content:${id}`);
  const saved = await loadPageContent(id);
  if (!saved) throw new HttpError(404, 'Event not found');
  return saved;
}
