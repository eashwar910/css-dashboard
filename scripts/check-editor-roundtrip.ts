// Checks that the dashboard's rich-text editor saves every event and meeting
// page body back to Notion without changing it. For each page: Notion's
// Markdown → toEditorMarkdown → the editor's Markdown parser/serializer (the
// same extensions as the browser) → written to one scratch page → read back
// and compared. Only the scratch page is written; it's moved to the trash at
// the end. Run after changing api/_lib/notionMarkdown.ts or
// src/lib/editorExtensions.ts.
//
// Usage: npx tsx --env-file=.env.local scripts/check-editor-roundtrip.ts
//
// Images are compared by position only: a Notion-hosted image can't move to
// another page, but on its own page Notion keeps it when the line comes back.

import type { PageObjectResponse } from '@notionhq/client';
import { MarkdownManager } from '@tiptap/markdown';
import { editorExtensions } from '../src/lib/editorExtensions';
import { dataSourceId, notion, queryAll } from '../api/_lib/notion.js';
import { toDisplayMarkdown, toEditorMarkdown } from '../api/_lib/notionMarkdown.js';
import { userNamesById } from '../api/_lib/users.js';

const markdown = new MarkdownManager({ extensions: editorExtensions() as never });
const names = await userNamesById();
const pages = [...(await queryAll(dataSourceId('events'))), ...(await queryAll(dataSourceId('meetings')))];

function pageTitle(page: PageObjectResponse): string {
  const prop = Object.values(page.properties).find((p) => p.type === 'title');
  return prop?.type === 'title' ? prop.title.map((t) => t.plain_text).join('') : page.id;
}

/** Ignore whitespace and image URLs (signed, different on every read). */
const normalise = (md: string) =>
  toDisplayMarkdown(md, names)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '![image]')
    .replace(/\s+/g, ' ')
    .trim();

const scratch = await notion().pages.create({
  parent: { type: 'data_source_id', data_source_id: dataSourceId('events') },
  properties: { Name: { title: [{ text: { content: 'ZZ editor round-trip scratch (delete me)' } }] } },
});

let differing = 0;
try {
  for (const page of pages) {
    const original = (await notion().pages.retrieveMarkdown({ page_id: page.id })).markdown;
    if (!original.trim()) continue;
    const edited = markdown.serialize(markdown.parse(toEditorMarkdown(original, names)));
    await notion().pages.updateMarkdown({
      page_id: scratch.id,
      type: 'replace_content',
      replace_content: { new_str: edited, allow_deleting_content: true },
    });
    const saved = (await notion().pages.retrieveMarkdown({ page_id: scratch.id })).markdown;

    const [before, after] = [normalise(original), normalise(saved)];
    if (before === after) {
      console.log(`same    ${pageTitle(page)}`);
      continue;
    }
    differing++;
    let i = 0;
    while (before[i] === after[i]) i++;
    console.log(`DIFFERS ${pageTitle(page)}`);
    console.log(`  was: ${JSON.stringify(before.slice(Math.max(0, i - 80), i + 80))}`);
    console.log(`  now: ${JSON.stringify(after.slice(Math.max(0, i - 80), i + 80))}`);
  }
} finally {
  await notion().pages.update({ page_id: scratch.id, in_trash: true });
}

console.log(differing ? `\n${differing} page(s) would change when saved from the dashboard.` : '\nEvery page round-trips unchanged.');
process.exitCode = differing ? 1 : 0;
