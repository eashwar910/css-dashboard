// Notion "enhanced Markdown" (pages.retrieveMarkdown) → plain GitHub-flavoured
// Markdown the dashboard can render. Handles the Notion tags that event and
// meeting pages actually use; any other tag is left for the client's HTML
// sanitiser, which drops the tag and keeps its text.

/** Wrapper tags whose content Notion indents by one tab per level. */
const WRAPPER_TAGS = ['meeting-notes', 'notes', 'summary', 'transcript'];

function attr(tag: string, name: string): string | null {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function formatDate(iso: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }),
  });
}

/** Cell text safe inside a Markdown table: no newlines or bare pipes. */
function tableCell(html: string): string {
  return html.replace(/<br\s*\/?>/gi, ' ').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim();
}

/** `<table>…</table>` → GFM table, so Markdown inside cells still renders. */
function tablesToGfm(md: string): string {
  return md.replace(/<table([^>]*)>([\s\S]*?)<\/table>/g, (_all, attrs: string, body: string) => {
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
      [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => tableCell(cell[1])),
    );
    if (rows.length === 0) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
    // GFM needs a header row; use Notion's if it has one, otherwise a blank one
    const hasHeader = /header-row="true"/.test(attrs);
    const header = hasHeader ? pad(rows[0]) : Array(width).fill(' ');
    const bodyRows = hasHeader ? rows.slice(1) : rows;
    const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
    return ['', line(header), line(Array(width).fill('---')), ...bodyRows.map((r) => line(pad(r))), ''].join('\n');
  });
}

/** Remove wrapper tags and the tab indentation Notion adds inside them. */
function unwrapIndentedBlocks(md: string): string {
  const open = new RegExp(`^\\s*<(${WRAPPER_TAGS.join('|')})\\b[^>]*>\\s*$`);
  const close = new RegExp(`^\\s*</(${WRAPPER_TAGS.join('|')})>\\s*$`);
  let depth = 0;
  const out: string[] = [];
  for (const line of md.split('\n')) {
    if (open.test(line)) {
      depth++;
      continue;
    }
    if (close.test(line)) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    let stripped = line;
    for (let i = 0; i < depth && stripped.startsWith('\t'); i++) stripped = stripped.slice(1);
    out.push(stripped);
  }
  return out.join('\n');
}

/**
 * Notion writes bold runs with spaces inside the markers (`**visit **with a**
 * Learn**`), which isn't valid Markdown bold. Move the spaces outside each
 * pair. Notion always emits pairs in order, so pairing left to right is safe.
 */
function tidyEmphasis(md: string): string {
  return md.replace(/\*\*(\s*)([^*\n]*?[^*\s])(\s*)\*\*/g, '$1**$2**$3');
}

/** A mention's readable label: "@Name" or a formatted date. */
function mentionLabel(tag: string, userNames: Map<string, string>): string {
  if (tag.startsWith('<mention-user')) {
    const id = attr(tag, 'url')?.replace(/^user:\/\//, '');
    return `@${(id && userNames.get(id)) ?? 'someone'}`;
  }
  if (tag.startsWith('<mention-date')) {
    const start = attr(tag, 'start');
    const end = attr(tag, 'end');
    if (!start) return 'date';
    return end ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);
  }
  const inner = tag.replace(/^<[^>]*>/, '').replace(/<\/[^>]*>$/, '').trim();
  return inner || 'mention';
}

export function toDisplayMarkdown(md: string, userNames: Map<string, string>): string {
  let out = tidyEmphasis(unwrapIndentedBlocks(md));
  out = tablesToGfm(out);
  out = out.replace(/<mention-user\b[^>]*\/?>/g, (tag) => {
    const id = attr(tag, 'url')?.replace(/^user:\/\//, '');
    return `**@${(id && userNames.get(id)) ?? 'someone'}**`;
  });
  out = out.replace(/<mention-date\b[^>]*\/?>/g, (tag) => {
    const start = attr(tag, 'start');
    const end = attr(tag, 'end');
    if (!start) return '';
    return end ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);
  });
  out = out.replace(/<empty-block\s*\/?>/g, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

const LIST_ITEM = /^(?:[-*+] |\d+[.)] )/;

/**
 * Reshape Notion's page Markdown so a Markdown parser reads the same blocks:
 *  - Notion puts one block per line with no blank lines, which a parser would
 *    merge ("a\nb" becomes one paragraph, a line after a list item becomes
 *    part of its text). Put a blank line between blocks at any depth, except
 *    between list items and table rows.
 *  - Child blocks are tab-indented. Markdown can only nest under list items;
 *    children of anything else (e.g. a paragraph) would read as a code block,
 *    so they're lifted to their parent's level. Their text is unchanged.
 * Code fences and Notion tags (kept verbatim by the editor) are left alone.
 */
function normaliseBlocks(md: string): string {
  const out: string[] = [];
  let fence = false;
  let tagDepth = 0;
  let prev: string | null = null;
  // Per raw tab depth: the latest line's output depth and whether it's a list item
  const parents: { depth: number; list: boolean }[] = [];
  for (const rawLine of md.split('\n')) {
    let line = rawLine;
    if (!fence && tagDepth === 0 && line.trim() !== '') {
      const tabs = line.match(/^\t*/)![0].length;
      const content = line.slice(tabs);
      const parent = tabs > 0 ? parents[tabs - 1] : undefined;
      const depth = tabs === 0 ? 0 : parent ? parent.depth + (parent.list ? 1 : 0) : tabs;
      parents[tabs] = { depth, list: LIST_ITEM.test(content) };
      parents.length = tabs + 1;
      line = '\t'.repeat(depth) + content;
      const needsGap =
        prev !== null &&
        prev.trim() !== '' &&
        !(LIST_ITEM.test(content) && LIST_ITEM.test(prev.trimStart())) &&
        !(content.startsWith('|') && prev.trimStart().startsWith('|'));
      if (needsGap) out.push('');
    }
    out.push(line);
    if (/^\s*```/.test(line)) fence = !fence;
    if (!fence) {
      // Track multi-line Notion tags (e.g. <meeting-notes>…</meeting-notes>) so their insides stay intact
      const opens = (line.match(/<(?!\/|br\b|span\b|mention-)[a-z][a-z0-9_-]*\b[^>]*?(?<!\/)>/g) ?? []).length;
      const closes = (line.match(/<\/(?!span\b|mention-)[a-z][a-z0-9_-]*>/g) ?? []).length;
      tagDepth = Math.max(0, tagDepth + opens - closes);
    }
    prev = line;
  }
  return out.join('\n');
}

/**
 * Notion's page Markdown → what the dashboard's rich-text editor loads.
 * Unlike toDisplayMarkdown it keeps anything the editor can save back
 * as-is: mention tags (with a display-only data-dash-label, removed again by
 * the editor), <br>, <empty-block/> and Notion-only blocks such as AI meeting notes.
 * Tables become GFM (Notion accepts GFM tables).
 */
export function toEditorMarkdown(md: string, userNames: Map<string, string>): string {
  let out = tablesToGfm(md);
  // Blank lines: the editor reads a "&nbsp;" paragraph as empty and saves it as <empty-block/>
  out = out.replace(/^(\s*)<empty-block\s*\/?>\s*$/gm, '$1&nbsp;');
  out = out.replace(/<empty-block\s*\/?>/g, ''); // e.g. inside table cells
  out = out.replace(/<(mention-[a-z]+)\b([^>]*?)(\/?)>/g, (tag, name: string, attrs: string, selfClose: string) => {
    const label = mentionLabel(tag, userNames).replace(/"/g, '&quot;');
    return `<${name}${attrs} data-dash-label="${label}"${selfClose}>`;
  });
  out = tidyEmphasis(out);
  // "A) …", "ii. …": plain text in Notion, but the editor would read a lettered list
  out = out.replace(/^(\s*)([A-Za-z]{1,4})([.)])(?=\s)/gm, '$1$2\\$3');
  return normaliseBlocks(out.replace(/\n{3,}/g, '\n\n')).trim();
}
